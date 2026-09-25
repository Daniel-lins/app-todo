import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getStorageKey,
  getContextId,
  isOnlyDemoTasks,
  loadContextTodos,
  saveContextTodos,
  migrateLegacyStorage,
  migrateGuestTasksToCloud,
  StorageLike,
  LEGACY_STORAGE_KEY,
  LEGACY_BACKUP_KEY,
  GUEST_STORAGE_KEY,
} from '../src/utils/todoStorage';
import { INITIAL_TODOS } from '../src/utils/todoConstants';
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

describe('Isolamento de Armazenamento e Migração Segura', () => {
  it('Separação explícita de chaves entre visitante, contas e grupos', () => {
    // Visitante
    assert.equal(getStorageKey(null, null), 'apptodo_tasks_guest');
    assert.equal(getContextId(null, null), 'guest');

    // Usuário 1 (Pessoal)
    assert.equal(getStorageKey('user-1', null), 'apptodo_tasks_user_user-1_personal');
    assert.equal(getContextId('user-1', null), 'user:user-1:personal');

    // Usuário 1 (Grupo A)
    assert.equal(getStorageKey('user-1', 'group-a'), 'apptodo_tasks_user_user-1_group_group-a');
    assert.equal(getContextId('user-1', 'group-a'), 'user:user-1:group:group-a');

    // Usuário 2 (Pessoal) - totalmente separado do Usuário 1
    assert.equal(getStorageKey('user-2', null), 'apptodo_tasks_user_user-2_personal');
    assert.notEqual(getStorageKey('user-1', null), getStorageKey('user-2', null));
  });

  it('Alternar contas e grupos não mistura dados gravados', () => {
    const storage = new MockStorage();

    const guestTodos: TodoItem[] = [
      {
        id: 't-guest',
        title: 'Tarefa de visitante',
        completed: false,
        priority: 'low',
        category: 'personal',
        pinned: false,
        subTasks: [],
        createdAt: '2026-01-01',
      },
    ];

    const user1PersonalTodos: TodoItem[] = [
      {
        id: 't-u1',
        title: 'Tarefa pessoal user 1',
        completed: true,
        priority: 'high',
        category: 'work',
        pinned: true,
        subTasks: [],
        createdAt: '2026-01-02',
      },
    ];

    const user1GroupTodos: TodoItem[] = [
      {
        id: 't-g1',
        title: 'Tarefa de equipe',
        completed: false,
        priority: 'medium',
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2026-01-03',
        groupId: 'team-alpha',
      },
    ];

    // Grava nos respectivos contextos isolados
    saveContextTodos(null, null, guestTodos, storage);
    saveContextTodos('user-1', null, user1PersonalTodos, storage);
    saveContextTodos('user-1', 'team-alpha', user1GroupTodos, storage);

    // Carrega e valida que nenhum contexto vazou para outro
    const loadedGuest = loadContextTodos(null, null, storage);
    assert.equal(loadedGuest.todos.length, 1);
    assert.equal(loadedGuest.todos[0].id, 't-guest');

    const loadedU1 = loadContextTodos('user-1', null, storage);
    assert.equal(loadedU1.todos.length, 1);
    assert.equal(loadedU1.todos[0].id, 't-u1');

    const loadedU1Group = loadContextTodos('user-1', 'team-alpha', storage);
    assert.equal(loadedU1Group.todos.length, 1);
    assert.equal(loadedU1Group.todos[0].id, 't-g1');

    // Um usuário 2 diferente não enxerga as tarefas de user-1
    const loadedU2 = loadContextTodos('user-2', null, storage);
    assert.equal(loadedU2.todos.length, 0);
  });

  it('Recarregar uma lista vazia mantém a lista vazia (não reinsere exemplos de demonstração)', () => {
    const storage = new MockStorage();

    // 1. Visitante novo: no primeiro acesso absoluto, inicializa com INITIAL_TODOS
    const firstAccess = loadContextTodos(null, null, storage);
    assert.equal(firstAccess.isFirstAccess, true);
    assert.equal(firstAccess.todos.length, INITIAL_TODOS.length);

    // 2. Usuário esvazia a lista e salva explicitamente []
    saveContextTodos(null, null, [], storage);

    // 3. Recarrega a lista: DEVE permanecer vazia ([]) e NÃO reinserir INITIAL_TODOS
    const secondAccess = loadContextTodos(null, null, storage);
    assert.equal(secondAccess.isFirstAccess, false);
    assert.equal(secondAccess.todos.length, 0);
    assert.deepEqual(secondAccess.todos, []);

    // 4. Da mesma forma para conta de usuário autenticado
    saveContextTodos('user-1', null, [], storage);
    const userReload = loadContextTodos('user-1', null, storage);
    assert.equal(userReload.todos.length, 0);
  });

  it('Identificação correta de conteúdo de demonstração (isOnlyDemoTasks)', () => {
    // Lista original é demo
    assert.equal(isOnlyDemoTasks(INITIAL_TODOS), true);

    // Lista vazia NÃO é demo
    assert.equal(isOnlyDemoTasks([]), false);

    // Lista com número diferente de tarefas não é demo
    assert.equal(isOnlyDemoTasks([INITIAL_TODOS[0]]), false);

    // Lista com tarefa customizada com IDs de demonstração mas título alterado pelo usuário NÃO é tratada como demo pura
    const modifiedDemo = INITIAL_TODOS.map((t, idx) =>
      idx === 0 ? { ...t, title: 'Minha tarefa personalizada importante' } : t
    );
    assert.equal(isOnlyDemoTasks(modifiedDemo), false);

    // Tarefa com ID diferente NÃO é demo
    const customTasks: TodoItem[] = [
      {
        id: 'user-task-1',
        title: 'Comprar leite',
        completed: false,
        priority: 'medium',
        category: 'personal',
        pinned: false,
        subTasks: [],
        createdAt: '2026-01-01',
      },
    ];
    assert.equal(isOnlyDemoTasks(customTasks), false);
  });

  it('Migração segura do armazenamento antigo sem descartar dados (apptodo_tasks_v1)', () => {
    const storage = new MockStorage();

    const legacyData = [
      {
        id: 'legacy-1',
        title: 'Tarefa legada importante',
        completed: false,
        priority: 'high',
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2025-12-01',
      },
    ];

    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyData));

    // Executa migração
    const migrated = migrateLegacyStorage(storage);
    assert.ok(migrated);
    assert.equal(migrated.length, 1);
    assert.equal(migrated[0].id, 'legacy-1');

    // Verifica que uma cópia de segurança permanente foi preservada
    assert.equal(storage.getItem(LEGACY_BACKUP_KEY), JSON.stringify(legacyData));
    // Verifica que os dados originais não foram excluídos
    assert.equal(storage.getItem(LEGACY_STORAGE_KEY), JSON.stringify(legacyData));
    // Verifica que o espaço de visitante agora possui os dados
    assert.equal(storage.getItem(GUEST_STORAGE_KEY), JSON.stringify(legacyData));
  });

  it('Falhar durante a migração para a nuvem preserva uma cópia recuperável e mantém as tarefas locais intactas', async () => {
    const storage = new MockStorage();

    const realUserTasks: TodoItem[] = [
      {
        id: 'real-1',
        title: 'Trabalho confidencial do visitante',
        completed: false,
        priority: 'urgent',
        category: 'work',
        pinned: true,
        subTasks: [],
        createdAt: '2026-03-01',
      },
    ];

    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(realUserTasks));

    // Mock client do Supabase que simula uma falha de banco de dados
    const failingSupabaseClient = { rpc: async () => ({ error: { message: 'Database connection timeout' } }) };

    const result = await migrateGuestTasksToCloud('user-42', failingSupabaseClient, storage);

    // Deve reportar falha
    assert.equal(result.success, false);
    assert.equal(result.migratedTasks.length, 1);
    assert.equal(result.migratedTasks[0].id, 'real-1');

    // DEVE preservar a cópia de recuperação
    const backup = storage.getItem('apptodo_migration_backup_user-42');
    assert.ok(backup, 'Backup de migração deve existir');
    const parsedBackup = JSON.parse(backup!);
    assert.equal(parsedBackup[0].id, 'real-1');

    // Tarefas locais no armazenamento de visitante NÃO podem ter sido apagadas
    const guestTasksAfterFailure = storage.getItem(GUEST_STORAGE_KEY);
    assert.equal(guestTasksAfterFailure, JSON.stringify(realUserTasks));
  });

  it('Migração com sucesso para a nuvem preserva dados na tela e limpa com segurança o espaço do visitante', async () => {
    const storage = new MockStorage();

    const realUserTasks: TodoItem[] = [
      {
        id: 'task-cloud-1',
        title: 'Estudar TypeScript',
        completed: true,
        priority: 'high',
        category: 'study',
        pinned: false,
        createdAt: '2026-03-02',
        subTasks: [
          { id: 'sub-1', title: 'Ler documentação', completed: true },
        ],
      },
    ];

    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(realUserTasks));

    const insertedRows: unknown[] = [];
    const successfulSupabaseClient = { rpc: async (_name: string, payload: unknown) => {
      insertedRows.push(payload); return { error: null };
    } };

    const result = await migrateGuestTasksToCloud('user-42', successfulSupabaseClient, storage);

    assert.equal(result.success, true);
    // A lista retornada NÃO pode estar vazia! Ela mantém as tarefas exibidas
    assert.equal(result.migratedTasks.length, 1);
    assert.equal(result.migratedTasks[0].id, 'task-cloud-1');

    // O cache pessoal do usuário no storage agora contém as tarefas
    const userPersonal = loadContextTodos('user-42', null, storage);
    assert.equal(userPersonal.todos.length, 1);
    assert.equal(userPersonal.todos[0].title, 'Estudar TypeScript');

    // O espaço de visitante é resetado para vazio para futuros acessos anônimos
    const guestSpaceAfter = storage.getItem(GUEST_STORAGE_KEY);
    assert.equal(guestSpaceAfter, '[]');
  });

  it('Tarefas padrão de demonstração não são migradas desnecessariamente para a nuvem', async () => {
    const storage = new MockStorage();

    // Visitante com apenas as tarefas iniciais de demo
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(INITIAL_TODOS));

    let insertCalled = false;
    const client = { rpc: async () => { insertCalled = true; return { error: null }; } };

    const result = await migrateGuestTasksToCloud('user-99', client, storage);

    // Sucesso, mas sem poluir a nuvem com demo inicial
    assert.equal(result.success, true);
    assert.equal(result.migratedTasks.length, 0);
    assert.equal(insertCalled, false, 'Não deve chamar inserção no banco para itens puramente de demonstração');
  });

  it('Proteção contra race condition com identificação estrita de contexto ativo', () => {
    // Simula duas requisições assíncronas concorrentes
    let activeRequestId = 0;
    let activeContext = getContextId('user-1', null);

    // Requisição 1 iniciada para o espaço pessoal do usuário
    const req1Id = ++activeRequestId;
    const req1Context = activeContext;

    // Usuário clica imediatamente para abrir um grupo antes de a requisição 1 responder
    const req2Id = ++activeRequestId;
    activeContext = getContextId('user-1', 'group-beta');
    const req2Context = activeContext;

    // Quando a resposta 1 finalmente chega, verifica se deve ser descartada
    const shouldDropReq1 = activeRequestId !== req1Id || activeContext !== req1Context;
    assert.equal(shouldDropReq1, true, 'Resposta assíncrona antiga de outro contexto deve ser descartada');

    // Quando a resposta 2 chega, verifica se corresponde ao contexto atual
    const shouldAcceptReq2 = activeRequestId === req2Id && activeContext === req2Context;
    assert.equal(shouldAcceptReq2, true, 'Resposta atual do contexto ativo deve ser aceita');
  });
});
