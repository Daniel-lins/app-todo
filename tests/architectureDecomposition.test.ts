import test from 'node:test';
import assert from 'node:assert/strict';
import { TodoItem } from '../src/types/todo';
import { 
  transitionTaskStatus, 
  toggleTaskCompleted, 
  sanitizeTaskUpdates, 
  calculateTaskStats 
} from '../src/utils/taskDomain';
import { 
  enqueueSyncItem, 
  loadSyncQueue, 
  StorageLike, 
  getStorageKey 
} from '../src/utils/todoStorage';

class MockMemoryStorage implements StorageLike {
  private memory = new Map<string, string>();
  getItem(key: string): string | null {
    return this.memory.has(key) ? this.memory.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.memory.set(key, String(value));
  }
  removeItem(key: string): void {
    this.memory.delete(key);
  }
}

test('Consolidação Arquitetural: Regras Compartilhadas entre Lista e Kanban', async (t) => {
  const baseTask: TodoItem = {
    id: 'task-100',
    title: 'Desenvolver consolidação',
    description: 'Implementar hooks desacoplados',
    completed: false,
    status: 'todo',
    priority: 'high',
    category: 'work',
    pinned: false,
    subTasks: [
      { id: 'sub-1', title: 'Criar sub-hooks', completed: false },
      { id: 'sub-2', title: 'Ajustar filtros', completed: false },
    ],
    createdAt: new Date().toISOString(),
  };

  await t.test('Transição de status sincroniza completed e completedAt tanto para Lista quanto Kanban', () => {
    // 1. Move para 'in_progress'
    const inProgress = transitionTaskStatus(baseTask, 'in_progress');
    assert.equal(inProgress.status, 'in_progress');
    assert.equal(inProgress.completed, false);
    assert.equal(inProgress.completedAt, undefined);

    // 2. Move para 'completed' (como soltar na coluna concluída do Kanban)
    const completed = transitionTaskStatus(inProgress, 'completed');
    assert.equal(completed.status, 'completed');
    assert.equal(completed.completed, true);
    assert.ok(completed.completedAt, 'completedAt deve ser preenchido');

    // 3. Reabre para 'todo'
    const reopened = transitionTaskStatus(completed, 'todo');
    assert.equal(reopened.status, 'todo');
    assert.equal(reopened.completed, false);
    assert.equal(reopened.completedAt, undefined);
  });

  await t.test('toggleTaskCompleted mantém consistência com status da tarefa', () => {
    // Conclui via checkbox (Lista)
    const toggledToDone = toggleTaskCompleted(baseTask);
    assert.equal(toggledToDone.completed, true);
    assert.equal(toggledToDone.status, 'completed');
    assert.ok(toggledToDone.completedAt);

    // Reabre via checkbox
    const toggledBack = toggleTaskCompleted({ ...baseTask, completed: true, status: 'completed' });
    assert.equal(toggledBack.completed, false);
    assert.equal(toggledBack.status, 'todo');
    assert.equal(toggledBack.completedAt, undefined);
  });

  await t.test('Cálculo de métricas de produtividade é idêntico para Lista e Kanban', () => {
    const taskList: TodoItem[] = [
      baseTask,
      {
        id: 'task-101',
        title: 'Tarefa Concluída',
        completed: true,
        status: 'completed',
        priority: 'urgent',
        category: 'work',
        pinned: true,
        subTasks: [],
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    ];

    const stats = calculateTaskStats(taskList);
    assert.equal(stats.total, 2);
    assert.equal(stats.completed, 1);
    assert.equal(stats.active, 1);
    assert.equal(stats.pinned, 1);
    assert.equal(stats.rate, 50);
  });
});

test('Persistência e Fila de Sincronização Desduplicada', async (t) => {
  const storage = new MockMemoryStorage();
  const userId = 'usr-test-1';
  const groupId = 'grp-test-1';

  await t.test('enqueueSyncItem desduplica ações sobre a mesma tarefa na fila', () => {
    const taskA: TodoItem = {
      id: 'task-sync-1',
      title: 'Primeira versão',
      completed: false,
      priority: 'medium',
      category: 'personal',
      pinned: false,
      subTasks: [],
      createdAt: new Date().toISOString(),
    };

    // 1. Enfileira primeira inserção
    enqueueSyncItem(userId, groupId, {
      taskId: taskA.id,
      action: 'upsert',
      contextId: groupId,
      task: taskA,
    }, storage);

    let queue = loadSyncQueue(userId, groupId, storage);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].task?.title, 'Primeira versão');

    // 2. Atualiza a mesma tarefa antes da sincronização terminar
    const taskAUpdated = { ...taskA, title: 'Título atualizado antes do sync' };
    enqueueSyncItem(userId, groupId, {
      taskId: taskA.id,
      action: 'upsert',
      contextId: groupId,
      task: taskAUpdated,
    }, storage);

    queue = loadSyncQueue(userId, groupId, storage);
    assert.equal(queue.length, 1, 'Não deve criar duas operações para o mesmo taskId');
    assert.equal(queue[0].task?.title, 'Título atualizado antes do sync');

    // 3. Se a tarefa for excluída antes do sync, substitui para delete
    enqueueSyncItem(userId, groupId, {
      taskId: taskA.id,
      action: 'delete',
      contextId: groupId,
    }, storage);

    queue = loadSyncQueue(userId, groupId, storage);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].action, 'delete');
  });

  await t.test('Isolamento de chave de armazenamento entre espaço pessoal e grupo', () => {
    const personalKey = getStorageKey(userId, null);
    const groupKey = getStorageKey(userId, groupId);
    const guestKey = getStorageKey(null, null);

    assert.notEqual(personalKey, groupKey, 'Espaço pessoal e grupo devem ter chaves distintas');
    assert.notEqual(personalKey, guestKey, 'Espaço pessoal e visitante devem ter chaves distintas');
    assert.ok(groupKey.includes(groupId), 'Chave de grupo deve conter o groupId');
  });
});

test('Higienização de Atualizações: Preservação de campos limpos vs removidos', async (t) => {
  const existing: TodoItem = {
    id: 'task-clean',
    title: 'Tarefa existente',
    description: 'Descrição original',
    dueDate: '2026-10-01',
    completed: false,
    priority: 'low',
    category: 'other',
    pinned: false,
    subTasks: [],
    createdAt: new Date().toISOString(),
  };

  await t.test('Limpeza de descrição envia null para Supabase e remove localmente', () => {
    const { cleanUpdates, dbUpdates } = sanitizeTaskUpdates({ description: '' }, existing);
    assert.equal(cleanUpdates.description, undefined);
    assert.equal(dbUpdates.description, null, 'Deve enviar null explícito para limpar no banco');
  });

  await t.test('Manter campo inalterado não inclui nos updates do banco', () => {
    const { cleanUpdates, dbUpdates } = sanitizeTaskUpdates({ title: 'Novo Título' }, existing);
    assert.equal(cleanUpdates.title, 'Novo Título');
    assert.equal(dbUpdates.title, 'Novo Título');
    assert.equal('description' in dbUpdates, false, 'Descrição não modificada não deve ser enviada');
  });
});
