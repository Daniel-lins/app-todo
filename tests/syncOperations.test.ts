import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSyncQueue,
  enqueueSyncItem,
  dequeueSyncItem,
  resolveTaskConflict,
  mergeCloudTasksWithLocal,
  syncPendingItemToCloud,
  loadContextTodos,
  saveContextTodos,
  PendingSyncItem,
  StorageLike,
} from '../src/utils/todoStorage';
import { TodoItem } from '../src/types/todo';

class MockStorage implements StorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Mock Supabase Client that allows simulating errors, network drops, and success
function createMockSupabaseClient(config: {
  shouldFail?: boolean;
  errorMessage?: string;
}) {
  const operations: Array<{ table: string; method: string; payload?: unknown }> = [];

  return {
    operations,
    async rpc(name: string, payload: unknown) {
      operations.push({ table: name, method: 'rpc', payload });
      return { error: config.shouldFail ? { message: config.errorMessage || 'Database error' } : null };
    },
  };
}

describe('Supabase Sync, Resiliência e Política de Conflitos', () => {
  it('1. Simulação de erro no Supabase: preserva localmente e enfileira na fila de sincronização', async () => {
    const storage = new MockStorage();
    const userId = 'user-test-1';
    const groupId = null;

    const task: TodoItem = {
      id: 'task-err-1',
      title: 'Tarefa criada offline/com erro',
      completed: false,
      pinned: false,
      priority: 'high',
      category: 'work',
      createdAt: '2026-09-24T10:00:00.000Z',
      updatedAt: '2026-09-24T10:00:00.000Z',
      subTasks: [],
      syncState: 'syncing',
    };

    // Salva localmente
    saveContextTodos(userId, groupId, [task], storage);

    // Simula cliente Supabase retornando erro de banco/timeout
    const mockClient = createMockSupabaseClient({
      shouldFail: true,
      errorMessage: 'connection timeout to supabase',
    });

    // Enfileira item de sincronização pendente
    enqueueSyncItem(
      userId,
      groupId,
      {
        taskId: task.id,
        action: 'upsert',
        task,
        contextId: 'user:user-test-1:personal',
      },
      storage
    );

    const pendingItem: PendingSyncItem = {
      id: 'sync-1',
      taskId: task.id,
      action: 'upsert',
      task,
      contextId: 'user:user-test-1:personal',
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Tenta sincronizar com o Supabase com erro retornado
    const result = await syncPendingItemToCloud(
      pendingItem,
      userId,
      groupId,
      mockClient as unknown as Parameters<typeof syncPendingItemToCloud>[3]
    );

    assert.equal(result.success, false, 'Deve indicar falha quando Supabase retorna error');
    assert.match(result.error || '', /connection timeout to supabase/);

    // Verifica que a tarefa NÃO sumiu do armazenamento local
    const { todos: localTodos } = loadContextTodos(userId, groupId, storage);
    assert.equal(localTodos.length, 1);
    assert.equal(localTodos[0].id, 'task-err-1');

    // Verifica que a fila de sincronização contém o item com dados intactos
    const queue = loadSyncQueue(userId, groupId, storage);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].taskId, 'task-err-1');
    assert.equal(queue[0].action, 'upsert');
    assert.equal(queue[0].task?.title, 'Tarefa criada offline/com erro');
  });

  it('2. Proteção contra duplicação na fila de sincronização em múltiplas tentativas', () => {
    const storage = new MockStorage();
    const userId = 'user-test-2';
    const groupId = 'group-123';

    const taskV1: TodoItem = {
      id: 'task-dup-1',
      title: 'Versão inicial',
      completed: false,
      pinned: false,
      priority: 'medium',
      category: 'personal',
      createdAt: '2026-09-24T11:00:00.000Z',
      updatedAt: '2026-09-24T11:00:00.000Z',
      subTasks: [],
    };

    // Enfileira primeira vez
    enqueueSyncItem(
      userId,
      groupId,
      {
        taskId: taskV1.id,
        action: 'upsert',
        task: taskV1,
        contextId: 'user:user-test-2:group:group-123',
      },
      storage
    );

    let queue = loadSyncQueue(userId, groupId, storage);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].task?.title, 'Versão inicial');

    // Usuário edita o título enquanto ainda está offline
    const taskV2: TodoItem = {
      ...taskV1,
      title: 'Versão atualizada enquanto offline',
      updatedAt: '2026-09-24T11:05:00.000Z',
    };

    // Enfileira segunda vez para a MESMA taskId
    enqueueSyncItem(
      userId,
      groupId,
      {
        taskId: taskV2.id,
        action: 'upsert',
        task: taskV2,
        contextId: 'user:user-test-2:group:group-123',
      },
      storage
    );

    // A fila DEVE manter tamanho 1 (sem itens duplicados) e atualizar os dados para a versão mais recente
    queue = loadSyncQueue(userId, groupId, storage);
    assert.equal(queue.length, 1, 'Não deve criar entradas duplicadas na fila para o mesmo taskId');
    assert.equal(queue[0].task?.title, 'Versão atualizada enquanto offline');
  });

  it('3. Política explícita de conflitos (resolveTaskConflict)', () => {
    const localPendingTask: TodoItem = {
      id: 'task-conflict-1',
      title: 'Edição local recente (pendente de envio)',
      completed: true,
      pinned: false,
      priority: 'high',
      category: 'work',
      createdAt: '2026-09-24T09:00:00.000Z',
      updatedAt: '2026-09-24T12:00:00.000Z',
      subTasks: [],
      syncState: 'local_only',
    };

    const incomingRemoteTask: TodoItem = {
      id: 'task-conflict-1',
      title: 'Versão que estava no servidor',
      completed: false,
      pinned: false,
      priority: 'low',
      category: 'study',
      createdAt: '2026-09-24T09:00:00.000Z',
      updatedAt: '2026-09-24T11:50:00.000Z',
      subTasks: [],
      syncState: 'synced',
    };

    // Caso A: Quando há alteração pendente local (hasPendingLocalChange = true)
    // A alteração local NUNCA deve ser sobrescrita pelo servidor
    const resolvedWithPending = resolveTaskConflict(localPendingTask, incomingRemoteTask, true);
    assert.equal(resolvedWithPending.title, 'Edição local recente (pendente de envio)');
    assert.equal(resolvedWithPending.completed, true);
    assert.equal(resolvedWithPending.syncState, 'local_only');

    // Caso B: Sem alteração pendente local (hasPendingLocalChange = false) -> Last-Write-Wins (LWW)
    // Remoto com timestamp mais recente ganha
    const olderLocalTask: TodoItem = {
      ...localPendingTask,
      updatedAt: '2026-09-24T10:00:00.000Z',
      syncState: 'synced',
    };
    const newerRemoteTask: TodoItem = {
      ...incomingRemoteTask,
      updatedAt: '2026-09-24T14:00:00.000Z',
      syncState: 'synced',
    };
    const resolvedLWW = resolveTaskConflict(olderLocalTask, newerRemoteTask, false);
    assert.equal(resolvedLWW.title, 'Versão que estava no servidor', 'LWW: Versão com timestamp mais recente vence');
    assert.equal(resolvedLWW.syncState, 'synced');
  });

  it('4. Mesclagem resiliente com nuvem (mergeCloudTasksWithLocal): nada desaparece silenciosamente', () => {
    const localTasks: TodoItem[] = [
      {
        id: 'task-a',
        title: 'Tarefa A',
        completed: false,
        pinned: false,
        priority: 'medium',
        category: 'work',
        createdAt: '2026-09-24T08:00:00.000Z',
        subTasks: [],
        syncState: 'synced',
      },
      {
        id: 'task-b',
        title: 'Tarefa B (criada offline)',
        completed: false,
        pinned: false,
        priority: 'high',
        category: 'personal',
        createdAt: '2026-09-24T09:30:00.000Z',
        subTasks: [],
        syncState: 'local_only',
      },
    ];

    const remoteTasks: TodoItem[] = [
      {
        id: 'task-a',
        title: 'Tarefa A (atualizada por colega)',
        completed: false,
        pinned: false,
        priority: 'urgent',
        category: 'work',
        createdAt: '2026-09-24T08:00:00.000Z',
        updatedAt: '2026-09-24T09:00:00.000Z',
        subTasks: [],
        syncState: 'synced',
      },
      {
        id: 'task-c',
        title: 'Tarefa C (remota antiga)',
        completed: true,
        pinned: false,
        priority: 'low',
        category: 'personal',
        createdAt: '2026-09-24T07:00:00.000Z',
        subTasks: [],
        syncState: 'synced',
      },
    ];

    const pendingQueue: PendingSyncItem[] = [
      {
        id: 'pending-1',
        taskId: 'task-b',
        action: 'upsert',
        task: localTasks[1],
        contextId: 'user:test:personal',
        timestamp: Date.now(),
        retryCount: 0,
      },
      {
        id: 'pending-2',
        taskId: 'task-c',
        action: 'delete',
        contextId: 'user:test:personal',
        timestamp: Date.now(),
        retryCount: 0,
      },
    ];

    const merged = mergeCloudTasksWithLocal(localTasks, remoteTasks, pendingQueue);

    // 1. Tarefa A deve ser atualizada com a versão remota
    const taskA = merged.find((t) => t.id === 'task-a');
    assert.ok(taskA);
    assert.equal(taskA.title, 'Tarefa A (atualizada por colega)');

    // 2. Tarefa B criada offline NÃO pode sumir mesmo não estando na resposta da nuvem
    const taskB = merged.find((t) => t.id === 'task-b');
    assert.ok(taskB, 'Tarefa criada offline não deve desaparecer na sincronização');
    assert.equal(taskB.title, 'Tarefa B (criada offline)');
    assert.equal(taskB.syncState, 'local_only');

    // 3. Tarefa C excluída offline NÃO pode ressuscitar
    const taskC = merged.find((t) => t.id === 'task-c');
    assert.equal(taskC, undefined, 'Tarefa com exclusão pendente não deve ressuscitar');
  });

  it('5. Nova tentativa (retry) bem-sucedida sincroniza e remove item da fila', async () => {
    const storage = new MockStorage();
    const userId = 'user-retry-1';
    const groupId = null;

    const task: TodoItem = {
      id: 'task-retry-success',
      title: 'Tarefa reenviada com sucesso',
      completed: false,
      pinned: false,
      priority: 'high',
      category: 'study',
      createdAt: '2026-09-24T12:00:00.000Z',
      subTasks: [
        { id: 'sub-1', title: 'Sub 1', completed: false },
      ],
      syncState: 'error',
    };

    // Item estava na fila de pendências
    enqueueSyncItem(
      userId,
      groupId,
      {
        taskId: task.id,
        action: 'upsert',
        task,
        contextId: 'user:user-retry-1:personal',
      },
      storage
    );

    assert.equal(loadSyncQueue(userId, groupId, storage).length, 1);

    // Simula cliente Supabase agora respondendo com sucesso
    const successClient = createMockSupabaseClient({ shouldFail: false });

    const pendingItem: PendingSyncItem = {
      id: 'sync-item-1',
      taskId: task.id,
      action: 'upsert',
      task,
      contextId: 'user:user-retry-1:personal',
      timestamp: Date.now(),
      retryCount: 0,
    };

    await syncPendingItemToCloud(
      pendingItem,
      userId,
      groupId,
      successClient as unknown as Parameters<typeof syncPendingItemToCloud>[3]
    );

    // Remove da fila após sucesso
    dequeueSyncItem(userId, groupId, task.id, storage);

    // Fila deve estar limpa
    const queueAfterRetry = loadSyncQueue(userId, groupId, storage);
    assert.equal(queueAfterRetry.length, 0, 'Fila deve ficar vazia após nova tentativa bem-sucedida');

    assert.equal(successClient.operations.length, 1);
    assert.equal(successClient.operations[0].table, 'apply_task_changes');
    const payload = successClient.operations[0].payload as { p_changes: Array<{ task: { id: string }; subtasks: unknown[] }> };
    assert.equal(payload.p_changes[0].task.id, 'task-retry-success');
    assert.equal(payload.p_changes[0].subtasks.length, 1);
  });
});
