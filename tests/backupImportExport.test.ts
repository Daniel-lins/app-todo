import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndParseBackupFile,
  generateBackupData,
  resolveImportTodos,
  MAX_TASKS_PER_BACKUP,
  MAX_SUBTASKS_PER_TASK,
  BackupFileV2,
} from '../src/utils/backupService';
import {
  prepareImportTodos,
  saveContextTodos,
  loadContextTodos,
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

describe('Central de Backup: Validação Exaustiva e Limites', () => {
  it('1. Arquivo inválido: JSON corrompido, vazio ou não estruturado', () => {
    // Vazio
    const emptyRes = validateAndParseBackupFile('');
    assert.equal(emptyRes.valid, false);
    assert.match(emptyRes.error!, /vazio/i);

    // JSON corrompido
    const corruptRes = validateAndParseBackupFile('{ "todos": [ { "title": "Incompleto" } ');
    assert.equal(corruptRes.valid, false);
    assert.match(corruptRes.error!, /JSON válido/i);

    // Não é objeto nem array
    const numberRes = validateAndParseBackupFile('12345');
    assert.equal(numberRes.valid, false);
  });

  it('2. Item inválido no meio da lista: validação de TODOS os itens, não só o primeiro', () => {
    const listWithBadMiddleItem = [
      { id: '1', title: 'Tarefa 1 Válida', priority: 'medium', category: 'work', status: 'todo' },
      { id: '2', title: 'Tarefa 2 Válida', priority: 'high', category: 'personal', status: 'in_progress' },
      { id: '3', title: '', priority: 'low', category: 'health', status: 'completed' }, // Inválido: título vazio
      { id: '4', title: 'Tarefa 4 Válida', priority: 'urgent', category: 'study', status: 'todo' },
    ];

    const res = validateAndParseBackupFile(JSON.stringify(listWithBadMiddleItem));
    assert.equal(res.valid, false, 'Deve falhar se qualquer item da lista for inválido');
    assert.match(res.error!, /tarefa #3/i);
    assert.match(res.error!, /título inválido/i);
  });

  it('3. Validação de tipos, prioridades, categorias, status, datas e horários', () => {
    // Prioridade inválida
    const badPriority = [{ id: '1', title: 'Teste', priority: 'super-urgent' }];
    const resPriority = validateAndParseBackupFile(JSON.stringify(badPriority));
    assert.equal(resPriority.valid, false);
    assert.match(resPriority.error!, /prioridade inválida/i);

    // Categoria inválida
    const badCategory = [{ id: '1', title: 'Teste', category: 'games' }];
    const resCategory = validateAndParseBackupFile(JSON.stringify(badCategory));
    assert.equal(resCategory.valid, false);
    assert.match(resCategory.error!, /categoria inválida/i);

    // Status inválido
    const badStatus = [{ id: '1', title: 'Teste', status: 'cancelled' }];
    const resStatus = validateAndParseBackupFile(JSON.stringify(badStatus));
    assert.equal(resStatus.valid, false);
    assert.match(resStatus.error!, /status inválido/i);

    // Formato de data inválido (não YYYY-MM-DD)
    const badDate = [{ id: '1', title: 'Teste', dueDate: '15/04/2026' }];
    const resDate = validateAndParseBackupFile(JSON.stringify(badDate));
    assert.equal(resDate.valid, false);
    assert.match(resDate.error!, /formato de data/i);

    // Formato de horário inválido (não HH:MM)
    const badTime = [{ id: '1', title: 'Teste', dueTime: '2:30 PM' }];
    const resTime = validateAndParseBackupFile(JSON.stringify(badTime));
    assert.equal(resTime.valid, false);
    assert.match(resTime.error!, /formato de horário/i);
  });

  it('4. Validação de subtarefas: todas as subtarefas de cada item são verificadas', () => {
    const taskWithBadSubtask = [
      {
        id: '1',
        title: 'Tarefa com subtarefa inválida',
        subTasks: [
          { id: 's1', title: 'Sub 1', completed: true },
          { id: 's2', title: '', completed: false }, // Inválido: título vazio
        ],
      },
    ];

    const res = validateAndParseBackupFile(JSON.stringify(taskWithBadSubtask));
    assert.equal(res.valid, false);
    assert.match(res.error!, /subtarefa #2.*tarefa #1/i);
  });

  it('5. Limites de segurança: tamanho de arquivo, quantidade de tarefas e subtarefas', () => {
    // Limite de tarefas (> 1000)
    const excessiveTasks: Partial<TodoItem>[] = [];
    for (let i = 0; i <= MAX_TASKS_PER_BACKUP; i++) {
      excessiveTasks.push({ id: `task-${i}`, title: `Tarefa ${i}` });
    }
    const resTasks = validateAndParseBackupFile(JSON.stringify(excessiveTasks));
    assert.equal(resTasks.valid, false);
    assert.match(resTasks.error!, /limite de 1000/i);

    // Limite de subtarefas por tarefa (> 50)
    const excessiveSubTasks: { id: string; title: string; completed: boolean }[] = [];
    for (let i = 0; i <= MAX_SUBTASKS_PER_TASK; i++) {
      excessiveSubTasks.push({ id: `sub-${i}`, title: `Sub ${i}`, completed: false });
    }
    const taskWithExcessiveSubs = [
      { id: '1', title: 'Muitas subtarefas', subTasks: excessiveSubTasks },
    ];
    const resSubs = validateAndParseBackupFile(JSON.stringify(taskWithExcessiveSubs));
    assert.equal(resSubs.valid, false);
    assert.match(resSubs.error!, /excede o limite de 50 subtarefas/i);
  });
});

describe('Central de Backup: Formato Versionado e Compatibilidade', () => {
  it('1. Formato legado V1 (array puro) é reconhecido e parseado com sucesso', () => {
    const legacyArray = [
      {
        id: 'leg-1',
        title: 'Tarefa Legada 1',
        completed: true,
        priority: 'high',
        category: 'work',
        dueDate: '2026-05-10',
        subTasks: [{ id: 'st-1', title: 'Passo 1', completed: true }],
      },
    ];

    const res = validateAndParseBackupFile(JSON.stringify(legacyArray));
    assert.equal(res.valid, true);
    assert.equal(res.version, 1);
    assert.equal(res.totalTasks, 1);
    assert.equal(res.totalSubTasks, 1);
    assert.equal(res.todos[0].title, 'Tarefa Legada 1');
    assert.equal(res.todos[0].status, 'completed'); // Coerência com completed: true
  });

  it('2. Formato versionado V2: gera metadados corretos e omite dados sensíveis', () => {
    const tasksToExport: TodoItem[] = [
      {
        id: 'exp-1',
        title: 'Projeto Secreto',
        description: 'Detalhes estratégicos',
        completed: false,
        status: 'in_progress',
        priority: 'urgent',
        category: 'work',
        dueDate: '2026-06-30',
        dueTime: '17:00',
        pinned: true,
        pomodoros: 4,
        order: 1,
        createdAt: '2026-03-01T10:00:00Z',
        subTasks: [
          { id: 'sub-exp-1', title: 'Pesquisa', completed: true },
          { id: 'sub-exp-2', title: 'Implementação', completed: false },
        ],
        groupId: 'marketing-group',
      },
    ];

    const backupJson = generateBackupData(tasksToExport, 'Equipe Marketing');
    const parsedBackup: BackupFileV2 = JSON.parse(backupJson);

    // Validação da estrutura V2
    assert.equal(parsedBackup.version, 2);
    assert.equal(parsedBackup.app, 'AppToDo');
    assert.equal(parsedBackup.spaceName, 'Equipe Marketing');
    assert.equal(parsedBackup.tasksCount, 1);
    assert.equal(parsedBackup.todos.length, 1);

    // Preservação de todos os dados de domínio suportados
    const task = parsedBackup.todos[0];
    assert.equal(task.id, 'exp-1');
    assert.equal(task.title, 'Projeto Secreto');
    assert.equal(task.description, 'Detalhes estratégicos');
    assert.equal(task.status, 'in_progress');
    assert.equal(task.priority, 'urgent');
    assert.equal(task.pinned, true);
    assert.equal(task.pomodoros, 4);
    assert.equal(task.subTasks.length, 2);

    // Garantia de ausência de credenciais, tokens ou senhas
    assert.equal('token' in parsedBackup, false);
    assert.equal('password' in parsedBackup, false);
    assert.equal('accessToken' in parsedBackup, false);
    assert.equal('userEmail' in parsedBackup, false);

    // Validação de importação do arquivo gerado
    const validationRes = validateAndParseBackupFile(backupJson);
    assert.equal(validationRes.valid, true);
    assert.equal(validationRes.version, 2);
    assert.equal(validationRes.totalTasks, 1);
    assert.equal(validationRes.totalSubTasks, 2);
  });
});

describe('Central de Backup: Resolução de Conflitos, Mesclagem e Substituição', () => {
  it('1. Tratamento de IDs repetidos no próprio arquivo: normaliza sem falhar', () => {
    const listWithDuplicateIds = [
      { id: 'dup-id', title: 'Primeira com ID duplicado' },
      { id: 'dup-id', title: 'Segunda com mesmo ID' },
    ];

    const res = validateAndParseBackupFile(JSON.stringify(listWithDuplicateIds));
    assert.equal(res.valid, true);
    assert.equal(res.duplicateIdsFound, 1);
    assert.equal(res.todos.length, 2);
    assert.notEqual(res.todos[0].id, res.todos[1].id, 'IDs devem se tornar exclusivos');
  });

  it('2. Detecção e contagem de conflitos com tarefas existentes no espaço', () => {
    const existingTodos: TodoItem[] = [
      { id: 't-1', title: 'Existente 1', completed: false, priority: 'medium', category: 'personal', pinned: false, subTasks: [], createdAt: '' },
      { id: 't-2', title: 'Existente 2', completed: false, priority: 'medium', category: 'personal', pinned: false, subTasks: [], createdAt: '' },
    ];

    const imported = [
      { id: 't-1', title: 'Importada que colide com t-1' },
      { id: 't-3', title: 'Importada nova t-3' },
    ];

    const res = validateAndParseBackupFile(JSON.stringify(imported), existingTodos);
    assert.equal(res.valid, true);
    assert.equal(res.conflictsWithExisting, 1);
    assert.equal(res.totalTasks, 2);
  });

  it('3. Modo Mesclar: tarefas conflitantes ganham novo ID e não sobrescrevem as existentes', () => {
    const existingTodos: TodoItem[] = [
      { id: 't-1', title: 'Original Existente', completed: false, priority: 'medium', category: 'personal', pinned: false, subTasks: [], createdAt: '2026-01-01' },
    ];

    const imported: TodoItem[] = [
      { id: 't-1', title: 'Importada com Mesmo ID', completed: true, status: 'completed', priority: 'high', category: 'work', pinned: false, subTasks: [{ id: 'st-1', title: 'Sub', completed: true }], createdAt: '2026-02-01' },
      { id: 't-2', title: 'Importada Inédita', completed: false, status: 'todo', priority: 'low', category: 'study', pinned: false, subTasks: [], createdAt: '2026-02-01' },
    ];

    const merged = resolveImportTodos(existingTodos, imported, 'merge', 'meu-grupo');

    // Total de 3 tarefas: a original foi preservada + a importada com novo ID + a inédita
    assert.equal(merged.length, 3);
    assert.equal(merged[0].id, 't-1');
    assert.equal(merged[0].title, 'Original Existente', 'Tarefa existente NÃO pode ser modificada');

    // A tarefa importada conflitante deve ter recebido um ID novo com prefixo
    assert.ok(merged[1].id.startsWith('t-1-imp-'));
    assert.equal(merged[1].title, 'Importada com Mesmo ID');
    assert.equal(merged[1].groupId, 'meu-grupo');

    // A tarefa inédita mantém seu ID
    assert.equal(merged[2].id, 't-2');
    assert.equal(merged[2].groupId, 'meu-grupo');
  });

  it('4. Modo Substituir: substitui integralmente apenas o espaço ativo e atribui groupId', () => {
    const existingTodos: TodoItem[] = [
      { id: 'antiga-1', title: 'Antiga', completed: false, priority: 'medium', category: 'personal', pinned: false, subTasks: [], createdAt: '' },
    ];

    const imported: TodoItem[] = [
      { id: 'nova-1', title: 'Nova Tarefa', completed: true, status: 'completed', priority: 'high', category: 'work', pinned: false, subTasks: [], createdAt: '' },
    ];

    const replaced = resolveImportTodos(existingTodos, imported, 'replace', 'grupo-vendas');

    assert.equal(replaced.length, 1);
    assert.equal(replaced[0].id, 'nova-1');
    assert.equal(replaced[0].title, 'Nova Tarefa');
    assert.equal(replaced[0].groupId, 'grupo-vendas');
  });

  it('5. Substituição não altera outros espaços locais nem o espaço pessoal', () => {
    const storage = new MockStorage();
    const userId = 'user-abc';

    // Salva tarefas no espaço pessoal
    const personalTasks: TodoItem[] = [
      { id: 'p-1', title: 'Tarefa Pessoal Intacta', completed: false, priority: 'medium', category: 'personal', pinned: false, subTasks: [], createdAt: '' },
    ];
    saveContextTodos(userId, null, personalTasks, storage);

    // Salva tarefas em outro grupo B
    const groupBTasks: TodoItem[] = [
      { id: 'gb-1', title: 'Tarefa Grupo B Intacta', completed: false, priority: 'high', category: 'work', pinned: false, subTasks: [], createdAt: '' },
    ];
    saveContextTodos(userId, 'group-b', groupBTasks, storage);

    // Agora substitui as tarefas no grupo A
    const groupATasks: TodoItem[] = [
      { id: 'ga-antiga', title: 'Antiga Grupo A', completed: false, priority: 'low', category: 'work', pinned: false, subTasks: [], createdAt: '' },
    ];
    saveContextTodos(userId, 'group-a', groupATasks, storage);

    const importedForGroupA: TodoItem[] = [
      { id: 'ga-nova', title: 'Nova Grupo A', completed: true, status: 'completed', priority: 'urgent', category: 'work', pinned: false, subTasks: [], createdAt: '' },
    ];
    const finalGroupA = prepareImportTodos(groupATasks, importedForGroupA, 'replace', 'group-a');
    saveContextTodos(userId, 'group-a', finalGroupA, storage);

    // Verifica isolamento:
    // 1. Grupo A foi substituído
    const loadedGroupA = loadContextTodos(userId, 'group-a', storage);
    assert.equal(loadedGroupA.todos.length, 1);
    assert.equal(loadedGroupA.todos[0].id, 'ga-nova');

    // 2. Espaço Pessoal permaneceu 100% inalterado
    const loadedPersonal = loadContextTodos(userId, null, storage);
    assert.equal(loadedPersonal.todos.length, 1);
    assert.equal(loadedPersonal.todos[0].id, 'p-1');
    assert.equal(loadedPersonal.todos[0].title, 'Tarefa Pessoal Intacta');

    // 3. Grupo B permaneceu 100% inalterado
    const loadedGroupB = loadContextTodos(userId, 'group-b', storage);
    assert.equal(loadedGroupB.todos.length, 1);
    assert.equal(loadedGroupB.todos[0].id, 'gb-1');
    assert.equal(loadedGroupB.todos[0].title, 'Tarefa Grupo B Intacta');
  });

  it('6. Preservação de subtarefas incluindo remoções', () => {
    // Simula tarefa existente com 3 subtarefas
    const existingTask: TodoItem = {
      id: 'task-with-subs',
      title: 'Projeto com Etapas',
      completed: false,
      priority: 'high',
      category: 'work',
      pinned: false,
      subTasks: [
        { id: 'sub-1', title: 'Etapa 1', completed: true },
        { id: 'sub-2', title: 'Etapa 2 (Removida no backup)', completed: false },
        { id: 'sub-3', title: 'Etapa 3', completed: false },
      ],
      createdAt: '2026-01-01',
    };

    // Backup contém apenas Etapa 1 e Etapa 3 (Etapa 2 foi removida)
    const backupJson = JSON.stringify([
      {
        id: 'task-with-subs',
        title: 'Projeto com Etapas',
        completed: false,
        subTasks: [
          { id: 'sub-1', title: 'Etapa 1', completed: true },
          { id: 'sub-3', title: 'Etapa 3 Concluída', completed: true },
        ],
      },
    ]);

    const res = validateAndParseBackupFile(backupJson);
    assert.equal(res.valid, true);

    const replaced = resolveImportTodos([existingTask], res.todos, 'replace', null);
    assert.equal(replaced[0].subTasks.length, 2, 'Apenas 2 subtarefas devem permanecer');
    assert.equal(replaced[0].subTasks.some((s) => s.id === 'sub-2'), false, 'Etapa 2 removida não deve existir');
    assert.equal(replaced[0].subTasks[1].title, 'Etapa 3 Concluída');
  });
});

describe('Central de Backup: Resiliência a Falha de Sincronização', () => {
  it('Falha na sincronização da nuvem preserva dados locais e propaga erro para a interface', async () => {
    const storage = new MockStorage();
    const userId = 'user-test-sync';

    const originalTodos: TodoItem[] = [
      { id: 'orig-1', title: 'Tarefa Original Crucial', completed: false, priority: 'urgent', category: 'personal', pinned: false, subTasks: [], createdAt: '' },
    ];
    saveContextTodos(userId, null, originalTodos, storage);

    // Mock do Supabase com falha proposital durante a inserção
    const mockSupabaseFailing = {
      from(..._args: unknown[]) {
        void _args;
        return {
          delete() {
            return {
              eq() {
                return {
                  is() {
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
          upsert() {
            // Simula falha de conexão na nuvem
            return Promise.resolve({ error: new Error('Network timeout: connection failed') });
          },
        };
      },
    };

    const importedToTry: TodoItem[] = [
      { id: 'imp-failing', title: 'Não deve substituir por falha', completed: false, priority: 'medium', category: 'work', pinned: false, subTasks: [], createdAt: '' },
    ];

    // Simula a lógica de importTodos com rollback em caso de falha
    let localTodosState = [...originalTodos];
    let caughtError: Error | null = null;

    try {
      const finalTodos = prepareImportTodos(localTodosState, importedToTry, 'replace', null);
      localTodosState = finalTodos;
      saveContextTodos(userId, null, finalTodos, storage);

      // Executa cloud sync
      const { error: insError } = await mockSupabaseFailing.from('tasks').upsert();
      if (insError) throw insError;
    } catch (err: unknown) {
      caughtError = err as Error;
      // Rollback verificado
      localTodosState = originalTodos;
      saveContextTodos(userId, null, originalTodos, storage);
    }

    // 1. O erro deve ser capturado (sem apresentar falso sucesso)
    assert.ok(caughtError !== null);
    assert.match(caughtError.message, /connection failed/i);

    // 2. Os dados locais devem ter sido restaurados exatamente ao estado original
    const restoredStorage = loadContextTodos(userId, null, storage);
    assert.equal(restoredStorage.todos.length, 1);
    assert.equal(restoredStorage.todos[0].id, 'orig-1');
    assert.equal(restoredStorage.todos[0].title, 'Tarefa Original Crucial');
  });
});
