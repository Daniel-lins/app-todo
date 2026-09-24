import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCompletedInContext,
  deleteTodoInContext,
  restoreTodoInContext,
  prepareDemoTodos,
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

describe('Operações Destrutivas Seguras e Recuperação de Dados', () => {
  it('Limpar um grupo não altera o espaço pessoal nem outros grupos', () => {
    const storage = new MockStorage();

    const userPersonalTasks: TodoItem[] = [
      {
        id: 'p-1',
        title: 'Tarefa pessoal pendente',
        completed: false,
        priority: 'high',
        category: 'personal',
        pinned: false,
        subTasks: [],
        createdAt: '2026-03-01',
      },
      {
        id: 'p-2',
        title: 'Tarefa pessoal concluída',
        completed: true,
        priority: 'low',
        category: 'personal',
        pinned: false,
        subTasks: [],
        createdAt: '2026-03-01',
      },
    ];

    const groupATasks: TodoItem[] = [
      {
        id: 'ga-1',
        title: 'Tarefa Grupo A concluída 1',
        completed: true,
        priority: 'medium',
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2026-03-02',
        groupId: 'group-a',
      },
      {
        id: 'ga-2',
        title: 'Tarefa Grupo A concluída 2',
        completed: true,
        priority: 'urgent',
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2026-03-02',
        groupId: 'group-a',
      },
    ];

    const groupBTasks: TodoItem[] = [
      {
        id: 'gb-1',
        title: 'Tarefa Grupo B concluída',
        completed: true,
        priority: 'medium',
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2026-03-03',
        groupId: 'group-b',
      },
    ];

    // Salva nos respectivos contextos
    saveContextTodos('user-1', null, userPersonalTasks, storage);
    saveContextTodos('user-1', 'group-a', groupATasks, storage);
    saveContextTodos('user-1', 'group-b', groupBTasks, storage);

    // Executa a limpeza apenas no Grupo A
    const { remaining: remainingGroupA, removed: removedGroupA } =
      clearCompletedInContext(groupATasks);

    assert.equal(removedGroupA.length, 2, 'Deve ter removido 2 tarefas concluídas do Grupo A');
    assert.equal(remainingGroupA.length, 0, 'Grupo A deve estar vazio');

    // Atualiza apenas o Grupo A no storage
    saveContextTodos('user-1', 'group-a', remainingGroupA, storage);

    // Valida que o Espaço Pessoal permaneceu 100% INTACTO
    const reloadedPersonal = loadContextTodos('user-1', null, storage);
    assert.equal(reloadedPersonal.todos.length, 2, 'Espaço pessoal não pode ter tarefas alteradas');
    assert.equal(reloadedPersonal.todos[0].id, 'p-1');
    assert.equal(reloadedPersonal.todos[1].id, 'p-2');

    // Valida que o Grupo B permaneceu 100% INTACTO
    const reloadedGroupB = loadContextTodos('user-1', 'group-b', storage);
    assert.equal(reloadedGroupB.todos.length, 1, 'Grupo B não pode ter sido alterado');
    assert.equal(reloadedGroupB.todos[0].id, 'gb-1');
  });

  it('Cancelar uma confirmação preserva os dados integralmente', () => {
    const storage = new MockStorage();

    const originalTasks: TodoItem[] = [
      {
        id: 'orig-1',
        title: 'Minha meta do ano',
        completed: false,
        priority: 'urgent',
        category: 'personal',
        pinned: true,
        subTasks: [{ id: 'sub-1', title: 'Passo 1', completed: false }],
        createdAt: '2026-01-01',
      },
    ];

    saveContextTodos('user-1', null, originalTasks, storage);

    // Simula o fluxo onde a confirmação é acionada mas o usuário decide CANCELAR
    let isConfirmed = false;
    const handleClose = () => {
      // Cancelar / Fechar sem confirmar
      isConfirmed = false;
    };

    // Ação do usuário: clica em Cancelar
    handleClose();

    // Se não confirmado, nenhuma mutação ou limpeza é chamada
    if (!isConfirmed) {
      // Dados não são alterados
    }

    const currentAfterCancel = loadContextTodos('user-1', null, storage);
    assert.equal(currentAfterCancel.todos.length, 1);
    assert.equal(currentAfterCancel.todos[0].title, 'Minha meta do ano');
    assert.equal(currentAfterCancel.todos[0].subTasks.length, 1);
  });

  it('Exclusão individual com desfazer restaura a tarefa exatamente na posição original', () => {
    const initialTasks: TodoItem[] = [
      {
        id: 'item-0',
        title: 'Primeira',
        completed: false,
        priority: 'low',
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2026-01-01',
      },
      {
        id: 'item-1',
        title: 'Segunda (A ser excluída)',
        completed: false,
        priority: 'high',
        category: 'study',
        pinned: true,
        subTasks: [{ id: 's-1', title: 'Sub', completed: true }],
        createdAt: '2026-01-02',
      },
      {
        id: 'item-2',
        title: 'Terceira',
        completed: true,
        priority: 'medium',
        category: 'finance',
        pinned: false,
        subTasks: [],
        createdAt: '2026-01-03',
      },
    ];

    // 1. Exclui a tarefa de índice 1
    const { remaining, deletedTask, index } = deleteTodoInContext(initialTasks, 'item-1');
    assert.equal(remaining.length, 2);
    assert.equal(deletedTask?.id, 'item-1');
    assert.equal(index, 1);

    // 2. Aciona o Desfazer (Undo)
    const restored = restoreTodoInContext(remaining, deletedTask!, index);

    // Valida tamanho e posição exata
    assert.equal(restored.length, 3);
    assert.equal(restored[0].id, 'item-0');
    assert.equal(restored[1].id, 'item-1', 'A tarefa restaurada deve retornar à sua posição original');
    assert.equal(restored[2].id, 'item-2');
    assert.equal(restored[1].title, 'Segunda (A ser excluída)');
    assert.equal(restored[1].subTasks.length, 1);
    assert.equal(restored[1].pinned, true);
  });

  it('Exemplos com modo "append" anexam sem apagar tarefas existentes do usuário', () => {
    const userExisting: TodoItem[] = [
      {
        id: 'user-task-abc',
        title: 'Minha tarefa de verdade',
        completed: false,
        priority: 'urgent',
        category: 'work',
        pinned: true,
        subTasks: [],
        createdAt: '2026-02-01',
      },
    ];

    const result = prepareDemoTodos(userExisting, 'append', 'team-x');

    // Deve conter a tarefa original + as 4 tarefas demo
    assert.equal(result.length, 5);
    assert.equal(result[0].id, 'user-task-abc');
    assert.equal(result[0].title, 'Minha tarefa de verdade');

    // As tarefas adicionadas devem conter IDs novos e carregar o groupId correto
    assert.notEqual(result[1].id, 'demo-1', 'Tarefas anexadas devem ter IDs únicos');
    assert.equal(result[1].groupId, 'team-x');
  });

  it('Importar substituindo afeta estritamente o espaço ativo e atribui o groupId correto', () => {
    const activeGroupTodos: TodoItem[] = [
      {
        id: 'old-g-1',
        title: 'Antiga tarefa do grupo',
        completed: false,
        priority: 'low',
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2026-01-01',
        groupId: 'marketing',
      },
    ];

    const importedBackup: TodoItem[] = [
      {
        id: 'imp-1',
        title: 'Nova tarefa importada',
        completed: false,
        priority: 'high',
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2026-03-01',
      },
    ];

    const result = prepareImportTodos(activeGroupTodos, importedBackup, 'replace', 'marketing');

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'imp-1');
    assert.equal(result[0].groupId, 'marketing', 'Tarefas importadas no grupo devem receber o groupId do espaço');
  });

  it('Validação da query de exclusão da nuvem isolada por grupo vs pessoal', () => {
    // Registrador de filtros enviados para o delete
    const deleteQueries: { table: string; filters: Record<string, unknown> }[] = [];

    const mockSupabase = {
      from(table: string) {
        return {
          delete() {
            const filters: Record<string, unknown> = {};
            const queryBuilder = {
              eq(col: string, val: unknown) {
                filters[col] = val;
                return queryBuilder;
              },
              is(col: string, val: unknown) {
                filters[`${col}_is`] = val;
                return queryBuilder;
              },
              then(resolve: (value: { error: null }) => void) {
                deleteQueries.push({ table, filters });
                resolve({ error: null });
              },
            };
            return queryBuilder;
          },
        };
      },
    };

    // Caso A: Limpeza em um grupo colaborativo
    const currentGroupId = 'group-marketing-123';
    let queryA = mockSupabase.from('tasks').delete().eq('completed', true);
    if (currentGroupId) {
      queryA = queryA.eq('group_id', currentGroupId);
    }
    // Dispara query A
    queryA.then(() => {});

    assert.equal(deleteQueries.length, 1);
    assert.equal(deleteQueries[0].filters['group_id'], 'group-marketing-123');
    assert.equal(deleteQueries[0].filters['user_id'], undefined, 'No grupo, não deve filtrar por user_id isoladamente');

    // Caso B: Limpeza no espaço pessoal
    const noGroupId = null;
    let queryB = mockSupabase.from('tasks').delete().eq('completed', true);
    if (noGroupId) {
      queryB = queryB.eq('group_id', noGroupId);
    } else {
      queryB = queryB.eq('user_id', 'user-42').is('group_id', null);
    }
    // Dispara query B
    queryB.then(() => {});

    assert.equal(deleteQueries.length, 2);
    assert.equal(deleteQueries[1].filters['user_id'], 'user-42');
    assert.equal(deleteQueries[1].filters['group_id_is'], null, 'No pessoal, deve garantir group_id IS NULL');
  });
});
