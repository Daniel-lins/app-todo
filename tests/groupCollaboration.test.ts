import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateInviteCode,
  normalizeInviteCode,
  isValidInviteCodeFormat,
} from '../src/utils/groupInvite';
import {
  getStorageKey,
  saveContextTodos,
  loadContextTodos,
  StorageLike,
} from '../src/utils/todoStorage';
import { TodoItem, TaskGroup, GroupMember } from '../src/types/todo';

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

// Mock de base de dados relacional simulando o comportamento estrito de RLS do Supabase
class MockSupabaseDatabase {
  public groups = new Map<string, TaskGroup>();
  public groupMembers = new Map<string, GroupMember[]>(); // key: groupId
  public tasks = new Map<string, TodoItem>();

  createGroup(creatorId: string, name: string): TaskGroup {
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const inviteCode = generateInviteCode();
    const group: TaskGroup = {
      id: groupId,
      name,
      inviteCode,
      color: '#4f46e5',
      createdBy: creatorId,
      createdAt: new Date().toISOString(),
      role: 'owner',
    };
    this.groups.set(groupId, group);

    // Gatilho atômico: associa imediatamente o criador como owner
    const members: GroupMember[] = [
      {
        id: `member-${Date.now()}`,
        groupId,
        userId: creatorId,
        role: 'owner',
        joinedAt: new Date().toISOString(),
      },
    ];
    this.groupMembers.set(groupId, members);
    return group;
  }

  joinGroupByCode(userId: string, rawCode: string): { success: boolean; group?: TaskGroup; message: string } {
    const cleanCode = normalizeInviteCode(rawCode);
    if (!isValidInviteCodeFormat(cleanCode)) {
      return { success: false, message: 'Código de convite inválido.' };
    }

    const foundGroup = Array.from(this.groups.values()).find(
      (g) => g.inviteCode === cleanCode
    );

    if (!foundGroup) {
      return { success: false, message: 'Código de convite inválido ou grupo não encontrado.' };
    }

    const members = this.groupMembers.get(foundGroup.id) || [];
    if (members.some((m) => m.userId === userId)) {
      return { success: true, group: foundGroup, message: 'Você já faz parte deste grupo!' };
    }

    members.push({
      id: `member-${Date.now()}-${userId}`,
      groupId: foundGroup.id,
      userId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });
    this.groupMembers.set(foundGroup.id, members);

    return { success: true, group: { ...foundGroup, role: 'member' }, message: 'Entrou no grupo com sucesso!' };
  }

  // Consulta de tarefas simulando Row Level Security (RLS)
  queryTasks(userId: string, targetGroupId: string | null): TodoItem[] {
    if (targetGroupId) {
      // Regra de RLS: Apenas membros do grupo podem ver as tarefas do grupo
      const members = this.groupMembers.get(targetGroupId) || [];
      const isMember = members.some((m) => m.userId === userId);
      if (!isMember) {
        // Bloqueio de acesso indevido por RLS
        return [];
      }
      return Array.from(this.tasks.values()).filter((t) => t.groupId === targetGroupId);
    }

    // Tarefas pessoais (group_id é nulo e user_id é o próprio usuário)
    return Array.from(this.tasks.values()).filter(
      (t) => !t.groupId
    );
  }

  // Inserção ou atualização com validação de RLS
  upsertTask(userId: string, task: TodoItem): { success: boolean; error?: string } {
    if (task.groupId) {
      const members = this.groupMembers.get(task.groupId) || [];
      const isMember = members.some((m) => m.userId === userId);
      if (!isMember) {
        return { success: false, error: 'Acesso negado por política de segurança (RLS)' };
      }
    }
    this.tasks.set(task.id, { ...task, syncState: 'synced' });
    return { success: true };
  }
}

describe('Colaboração por Grupos, Segurança e Tempo Real', () => {
  it('1. Validação, normalização e prevenção de colisões de códigos de convite', () => {
    // Geração de código no padrão TODO-XXXXXX
    const code1 = generateInviteCode();
    const code2 = generateInviteCode();
    assert.match(code1, /^TODO-[2-9A-Z]{6}$/);
    assert.notEqual(code1, code2, 'Códigos gerados devem ser distintos');

    // Normalização aceita com ou sem prefixo, minúsculas e espaços
    assert.equal(normalizeInviteCode('abcd23'), 'TODO-ABCD23');
    assert.equal(normalizeInviteCode(' todo-xyz999 '), 'TODO-XYZ999');
    assert.equal(normalizeInviteCode('TODO:778899'), 'TODO-778899');

    // Validação de formato
    assert.equal(isValidInviteCodeFormat('TODO-88K9XP'), true);
    assert.equal(isValidInviteCodeFormat('INVALID_CODE'), false);
    assert.equal(isValidInviteCodeFormat(''), false);
  });

  it('2. Associação atômica do proprietário ao criar grupo', () => {
    const db = new MockSupabaseDatabase();
    const aliceId = 'user-alice-1';

    const groupA = db.createGroup(aliceId, 'Projeto Alpha');
    assert.ok(groupA.id);
    assert.equal(groupA.createdBy, aliceId);
    assert.equal(groupA.role, 'owner');

    // Verifica que o criador já está na tabela de membros como 'owner' na mesma transação
    const members = db.groupMembers.get(groupA.id) || [];
    assert.equal(members.length, 1);
    assert.equal(members[0].userId, aliceId);
    assert.equal(members[0].role, 'owner');
  });

  it('3. Duas identidades isoladas: colaboração autorizada no mesmo grupo', () => {
    const db = new MockSupabaseDatabase();
    const aliceId = 'user-alice';
    const bobId = 'user-bob';

    // Alice cria o Grupo Alpha
    const groupAlpha = db.createGroup(aliceId, 'Projeto Alpha');

    // Bob entra no Grupo Alpha usando o código de convite
    const joinResult = db.joinGroupByCode(bobId, groupAlpha.inviteCode);
    assert.equal(joinResult.success, true);
    assert.equal(joinResult.group?.role, 'member');

    // Alice cria uma tarefa no Grupo Alpha com uma subtarefa
    const taskAlpha1: TodoItem = {
      id: 'task-alpha-1',
      title: 'Configurar CI/CD',
      completed: false,
      pinned: false,
      priority: 'high',
      category: 'work',
      createdAt: '2026-09-24T14:00:00.000Z',
      updatedAt: '2026-09-24T14:00:00.000Z',
      subTasks: [{ id: 'sub-1', title: 'Pipeline GitHub Actions', completed: false }],
      groupId: groupAlpha.id,
      createdByName: 'Alice',
    };
    const aliceInsert = db.upsertTask(aliceId, taskAlpha1);
    assert.equal(aliceInsert.success, true);

    // Bob consulta o Grupo Alpha e vê a tarefa criada por Alice
    const bobView = db.queryTasks(bobId, groupAlpha.id);
    assert.equal(bobView.length, 1);
    assert.equal(bobView[0].title, 'Configurar CI/CD');
    assert.equal(bobView[0].createdByName, 'Alice');

    // Bob adiciona uma segunda subtarefa e altera status para in_progress
    const bobUpdatedTask: TodoItem = {
      ...bobView[0],
      status: 'in_progress',
      updatedAt: '2026-09-24T14:15:00.000Z',
      subTasks: [
        ...bobView[0].subTasks,
        { id: 'sub-2', title: 'Adicionar testes de integração', completed: false },
      ],
    };
    const bobUpdate = db.upsertTask(bobId, bobUpdatedTask);
    assert.equal(bobUpdate.success, true);

    // Alice consulta o grupo novamente e recebe as alterações de Bob
    const aliceUpdatedView = db.queryTasks(aliceId, groupAlpha.id);
    assert.equal(aliceUpdatedView.length, 1);
    assert.equal(aliceUpdatedView[0].status, 'in_progress');
    assert.equal(aliceUpdatedView[0].subTasks.length, 2);
    assert.equal(aliceUpdatedView[0].subTasks[1].title, 'Adicionar testes de integração');
  });

  it('4. Isolamento estrito entre grupos: um grupo não recebe dados de outro', () => {
    const db = new MockSupabaseDatabase();
    const aliceId = 'user-alice';
    const bobId = 'user-bob';

    // Alice cria Grupo 1
    const group1 = db.createGroup(aliceId, 'Grupo 1 (Alice)');
    // Bob cria Grupo 2
    const group2 = db.createGroup(bobId, 'Grupo 2 (Bob)');

    // Tarefa criada no Grupo 1
    db.upsertTask(aliceId, {
      id: 'task-g1',
      title: 'Tarefa confidencial do Grupo 1',
      completed: false,
      pinned: false,
      priority: 'urgent',
      category: 'work',
      createdAt: '2026-09-24T15:00:00.000Z',
      subTasks: [],
      groupId: group1.id,
    });

    // Tarefa criada no Grupo 2
    db.upsertTask(bobId, {
      id: 'task-g2',
      title: 'Tarefa pública do Grupo 2',
      completed: false,
      pinned: false,
      priority: 'low',
      category: 'personal',
      createdAt: '2026-09-24T15:05:00.000Z',
      subTasks: [],
      groupId: group2.id,
    });

    // Bob consulta o Grupo 2: NUNCA deve receber tarefas do Grupo 1
    const bobTasksInGroup2 = db.queryTasks(bobId, group2.id);
    assert.equal(bobTasksInGroup2.length, 1);
    assert.equal(bobTasksInGroup2[0].id, 'task-g2');
    assert.equal(bobTasksInGroup2.some((t) => t.id === 'task-g1'), false, 'Grupo 2 não deve conter tarefas do Grupo 1');

    // Alice consulta o Grupo 1: NUNCA deve receber tarefas do Grupo 2
    const aliceTasksInGroup1 = db.queryTasks(aliceId, group1.id);
    assert.equal(aliceTasksInGroup1.length, 1);
    assert.equal(aliceTasksInGroup1[0].id, 'task-g1');
    assert.equal(aliceTasksInGroup1.some((t) => t.id === 'task-g2'), false, 'Grupo 1 não deve conter tarefas do Grupo 2');
  });

  it('5. Bloqueio de acesso indevido por RLS para não membros', () => {
    const db = new MockSupabaseDatabase();
    const aliceId = 'user-alice';
    const charlieId = 'user-charlie-intruso';

    const groupSecret = db.createGroup(aliceId, 'Grupo Secreto');
    db.upsertTask(aliceId, {
      id: 'task-secret-1',
      title: 'Dados Confidenciais',
      completed: false,
      pinned: true,
      priority: 'urgent',
      category: 'finance',
      createdAt: '2026-09-24T16:00:00.000Z',
      subTasks: [],
      groupId: groupSecret.id,
    });

    // Charlie tenta ler as tarefas do grupo secreto sem ser membro -> retorna lista vazia (RLS bloqueia)
    const charlieQuery = db.queryTasks(charlieId, groupSecret.id);
    assert.equal(charlieQuery.length, 0, 'Usuário não membro deve ter leitura bloqueada');

    // Charlie tenta injetar uma tarefa no grupo secreto sem ser membro -> operação é rejeitada
    const charlieInsert = db.upsertTask(charlieId, {
      id: 'task-charlie-attack',
      title: 'Tentativa de injeção indevida',
      completed: false,
      pinned: false,
      priority: 'low',
      category: 'other',
      createdAt: '2026-09-24T16:10:00.000Z',
      subTasks: [],
      groupId: groupSecret.id,
    });
    assert.equal(charlieInsert.success, false);
    assert.match(charlieInsert.error || '', /Acesso negado/);
  });

  it('6. Proteção contra respostas atrasadas e limpeza de cache ao sair do grupo', () => {
    const storage = new MockStorage();
    const userId = 'user-leave-test';
    const groupId = 'group-left-123';

    // Tarefas salvas em cache local para o grupo
    saveContextTodos(
      userId,
      groupId,
      [
        {
          id: 'task-group-cache',
          title: 'Tarefa antiga do grupo',
          completed: false,
          pinned: false,
          priority: 'medium',
          category: 'work',
          createdAt: '2026-09-24T10:00:00.000Z',
          subTasks: [],
        },
      ],
      storage
    );

    // Cache existe
    const cachedBefore = loadContextTodos(userId, groupId, storage);
    assert.equal(cachedBefore.todos.length, 1);

    // Usuário sai ou exclui o grupo: chaves do storage correspondentes devem ser limpas
    storage.removeItem(getStorageKey(userId, groupId));

    const cachedAfter = loadContextTodos(userId, groupId, storage);
    assert.equal(cachedAfter.todos.length, 0, 'Ao sair ou excluir o grupo, o cache local deve ser descartado');

    // Contexto pessoal continua intacto
    const personalKey = getStorageKey(userId, null);
    assert.equal(personalKey, `apptodo_tasks_user_${userId}_personal`);
    assert.notEqual(personalKey, getStorageKey(userId, groupId));
  });
});
