import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TodoItem } from '../src/types/todo';
import {
  transitionTaskStatus,
  toggleTaskCompleted,
  toggleSubTaskInTask,
  sanitizeTaskUpdates,
  calculateTaskStats,
  syncProfileCompletedCount,
} from '../src/utils/taskDomain';
import {
  getLocalDateString,
  isTodayLocal,
  isOverdueLocal,
  getMsUntilNextMidnight,
} from '../src/utils/dateUtils';

describe('Regras de Domínio de Tarefas: Consistência entre Lista e Kanban', () => {
  const baseTask: TodoItem = {
    id: 'task-1',
    title: 'Tarefa Teste',
    description: 'Descrição inicial',
    completed: false,
    status: 'todo',
    priority: 'high',
    category: 'work',
    dueDate: '2026-09-24',
    dueTime: '15:00',
    pinned: false,
    pomodoros: 0,
    order: 0,
    createdAt: '2026-09-24T10:00:00.000Z',
    subTasks: [
      { id: 'sub-1', title: 'Sub 1', completed: false },
      { id: 'sub-2', title: 'Sub 2', completed: false },
    ],
  };

  it('Modo Lista: Concluir e reabrir tarefa atualiza status e completed sem divergência', () => {
    const now = '2026-09-24T12:00:00.000Z';
    // 1. Concluir
    const completedTask = toggleTaskCompleted(baseTask, now);
    assert.equal(completedTask.completed, true);
    assert.equal(completedTask.status, 'completed');
    assert.equal(completedTask.completedAt, now);
    assert.ok(completedTask.subTasks.every((s) => s.completed === true));

    // 2. Reabrir
    const reopenedTask = toggleTaskCompleted(completedTask, '2026-09-24T12:05:00.000Z');
    assert.equal(reopenedTask.completed, false);
    assert.equal(reopenedTask.status, 'todo', 'Ao reabrir no modo lista, status deve ser "todo" e nunca "completed"');
    assert.equal(reopenedTask.completedAt, undefined, 'completedAt deve ser limpo ao reabrir');
  });

  it('Modo Kanban: Mover tarefa entre colunas mantém coerência absoluta com completed e completedAt', () => {
    const now = '2026-09-24T14:00:00.000Z';
    // Mover para 'in_progress'
    const inProgress = transitionTaskStatus(baseTask, 'in_progress', now);
    assert.equal(inProgress.status, 'in_progress');
    assert.equal(inProgress.completed, false);
    assert.equal(inProgress.completedAt, undefined);

    // Mover para 'completed'
    const completed = transitionTaskStatus(inProgress, 'completed', now);
    assert.equal(completed.status, 'completed');
    assert.equal(completed.completed, true);
    assert.equal(completed.completedAt, now);
    assert.ok(completed.subTasks.every((s) => s.completed === true));

    // Reabrir movendo de volta para 'in_progress'
    const movedBack = transitionTaskStatus(completed, 'in_progress', '2026-09-24T14:30:00.000Z');
    assert.equal(movedBack.status, 'in_progress');
    assert.equal(movedBack.completed, false);
    assert.equal(movedBack.completedAt, undefined, 'completedAt deve ser indefinido ao mover de concluída para em andamento');

    // Reabrir movendo para 'todo'
    const backToTodo = transitionTaskStatus(completed, 'todo', '2026-09-24T14:35:00.000Z');
    assert.equal(backToTodo.status, 'todo');
    assert.equal(backToTodo.completed, false);
    assert.equal(backToTodo.completedAt, undefined);
  });
});

describe('Regras de Domínio: Concluir e Reabrir Subtarefas', () => {
  const taskWithSubs: TodoItem = {
    id: 'task-subs',
    title: 'Projeto Grande',
    completed: false,
    status: 'todo',
    priority: 'urgent',
    category: 'work',
    pinned: false,
    pomodoros: 0,
    order: 0,
    createdAt: '2026-09-24T08:00:00.000Z',
    subTasks: [
      { id: 'sub-a', title: 'Parte 1', completed: false },
      { id: 'sub-b', title: 'Parte 2', completed: false },
    ],
  };

  it('Concluir a primeira subtarefa não conclui a tarefa pai', () => {
    const res1 = toggleSubTaskInTask(taskWithSubs, 'sub-a');
    assert.equal(res1.subTaskCompleted, true);
    assert.equal(res1.parentCompletedChanged, false);
    assert.equal(res1.updatedTask.completed, false);
    assert.equal(res1.updatedTask.subTasks[0].completed, true);
    assert.equal(res1.updatedTask.subTasks[1].completed, false);
  });

  it('Concluir todas as subtarefas conclui automaticamente a tarefa pai', () => {
    const step1 = toggleSubTaskInTask(taskWithSubs, 'sub-a');
    const step2 = toggleSubTaskInTask(step1.updatedTask, 'sub-b', '2026-09-24T09:30:00.000Z');

    assert.equal(step2.subTaskCompleted, true);
    assert.equal(step2.parentCompletedChanged, true, 'Deve sinalizar que a conclusão do pai mudou para atualizar no Supabase');
    assert.equal(step2.newParentCompleted, true);
    assert.equal(step2.updatedTask.completed, true);
    assert.equal(step2.updatedTask.status, 'completed');
    assert.equal(step2.updatedTask.completedAt, '2026-09-24T09:30:00.000Z');
  });

  it('Reabrir uma subtarefa em tarefa concluída reabre o pai para in_progress', () => {
    // Começa com todas as subtarefas concluídas e pai concluído
    const completedParent: TodoItem = {
      ...taskWithSubs,
      completed: true,
      status: 'completed',
      completedAt: '2026-09-24T09:00:00.000Z',
      subTasks: [
        { id: 'sub-a', title: 'Parte 1', completed: true },
        { id: 'sub-b', title: 'Parte 2', completed: true },
      ],
    };

    const res = toggleSubTaskInTask(completedParent, 'sub-a');
    assert.equal(res.subTaskCompleted, false);
    assert.equal(res.parentCompletedChanged, true, 'Deve avisar que o pai reabriu');
    assert.equal(res.newParentCompleted, false);
    assert.equal(res.updatedTask.completed, false);
    assert.equal(res.updatedTask.status, 'in_progress', 'Pai com parte das subtarefas prontas deve ficar in_progress');
    assert.equal(res.updatedTask.completedAt, undefined);
  });
});

describe('Regras de Domínio: Diferenciação entre Campo Não Alterado e Campo Removido', () => {
  const currentTask: TodoItem = {
    id: 'task-clean',
    title: 'Comprar presentes',
    description: 'Comprar presente de aniversário do Pedro',
    dueDate: '2026-09-30',
    dueTime: '18:00',
    priority: 'medium',
    category: 'personal',
    pinned: false,
    pomodoros: 0,
    order: 0,
    completed: false,
    status: 'todo',
    createdAt: '2026-09-24T10:00:00.000Z',
    subTasks: [],
  };

  it('Limpar descrição, data ou horário envia null explícito para o banco e limpa no local', () => {
    // Simula envio de string vazia ou undefined ao remover
    const updates = {
      description: '',
      dueDate: undefined,
      dueTime: '',
    };

    const { cleanUpdates, dbUpdates } = sanitizeTaskUpdates(updates, currentTask);

    // No estado local:
    assert.equal(cleanUpdates.description, undefined);
    assert.equal(cleanUpdates.dueDate, undefined);
    assert.equal(cleanUpdates.dueTime, undefined);

    // No payload do Supabase (MANDATÓRIO: null explícito para o PostgreSQL limpar a coluna):
    assert.equal(dbUpdates.description, null);
    assert.equal(dbUpdates.due_date, null);
    assert.equal(dbUpdates.due_time, null);
  });

  it('Campos não modificados não são incluídos no payload de atualização', () => {
    // Atualiza apenas o título
    const updates = {
      title: 'Comprar presentes de Natal',
    };

    const { cleanUpdates, dbUpdates } = sanitizeTaskUpdates(updates, currentTask);

    assert.equal(cleanUpdates.title, 'Comprar presentes de Natal');
    assert.equal('description' in cleanUpdates, false);
    assert.equal('dueDate' in cleanUpdates, false);
    assert.equal('dueTime' in cleanUpdates, false);

    assert.equal(dbUpdates.title, 'Comprar presentes de Natal');
    assert.equal('description' in dbUpdates, false);
    assert.equal('due_date' in dbUpdates, false);
    assert.equal('due_time' in dbUpdates, false);
  });

  it('Recarregar/aplicar as atualizações limpas não restaura campos que foram removidos', () => {
    const updates = {
      description: '',
      dueDate: '',
      dueTime: '',
    };

    const { cleanUpdates, dbUpdates } = sanitizeTaskUpdates(updates, currentTask);

    // Aplica no objeto da tarefa
    const merged: TodoItem = {
      ...currentTask,
      ...cleanUpdates,
    };

    assert.equal(merged.description, undefined);
    assert.equal(merged.dueDate, undefined);
    assert.equal(merged.dueTime, undefined);

    // Simula reload remoto a partir das colunas retornadas pelo banco com NULL
    const simulatedDbRow = {
      description: dbUpdates.description, // null
      due_date: dbUpdates.due_date,       // null
      due_time: dbUpdates.due_time,       // null
    };

    const reloadedTask: Partial<TodoItem> = {
      description: typeof simulatedDbRow.description === 'string' ? simulatedDbRow.description : undefined,
      dueDate: typeof simulatedDbRow.due_date === 'string' ? simulatedDbRow.due_date : undefined,
      dueTime: typeof simulatedDbRow.due_time === 'string' ? simulatedDbRow.due_time : undefined,
    };

    assert.equal(reloadedTask.description, undefined);
    assert.equal(reloadedTask.dueDate, undefined);
    assert.equal(reloadedTask.dueTime, undefined);
  });
});

describe('Fuso Horário Local e Horários Próximos da Meia-Noite', () => {
  it('Data local vs UTC: às 23:50 em UTC-3 o UTC já é dia 25, mas local deve ser dia 24', () => {
    // 2026-09-24 às 23:50 no horário local de Brasília (UTC-3)
    const explicitLocal = new Date(2026, 8, 24, 23, 50, 0); // 24 de Setembro de 2026
    const localDateStr = getLocalDateString(explicitLocal);
    assert.equal(localDateStr, '2026-09-24', 'getLocalDateString deve respeitar a data do relógio local');

    // Tarefa agendada para 2026-09-24 deve ser reconhecida como HOJE
    assert.equal(isTodayLocal('2026-09-24', explicitLocal), true);
    assert.equal(isOverdueLocal('2026-09-24', explicitLocal), false);

    // Tarefa agendada para 2026-09-23 às 23:50 já está atrasada
    assert.equal(isOverdueLocal('2026-09-23', explicitLocal), true);
  });

  it('Virada da meia-noite: às 00:01 do dia seguinte a tarefa do dia anterior se torna atrasada', () => {
    const afterMidnight = new Date(2026, 8, 25, 0, 1, 0); // 25 de Setembro de 2026, 00:01
    const localDateStr = getLocalDateString(afterMidnight);
    assert.equal(localDateStr, '2026-09-25');

    // A tarefa de ontem (24) agora é atrasada
    assert.equal(isTodayLocal('2026-09-24', afterMidnight), false);
    assert.equal(isOverdueLocal('2026-09-24', afterMidnight), true);

    // A tarefa de hoje (25) é para hoje
    assert.equal(isTodayLocal('2026-09-25', afterMidnight), true);
    assert.equal(isOverdueLocal('2026-09-25', afterMidnight), false);
  });

  it('Cálculo de milissegundos até a próxima meia-noite é positivo e menor que 24 horas', () => {
    const now = new Date(2026, 8, 24, 23, 59, 30); // 30 segundos antes da meia-noite
    const ms = getMsUntilNextMidnight(now);
    assert.ok(ms >= 30000 && ms <= 31000, `ms deve ser ~30500, obtido: ${ms}`);
  });
});

describe('Métricas de Perfil e Estatísticas sem Duplicação', () => {
  it('Alternar concluir e reabrir repetidamente não infla a contagem de tarefas concluídas do perfil', () => {
    let profileCompletedCount = 5;

    // Conclui 1x (+1)
    profileCompletedCount = syncProfileCompletedCount(profileCompletedCount, 1);
    assert.equal(profileCompletedCount, 6);

    // Reabre 1x (-1)
    profileCompletedCount = syncProfileCompletedCount(profileCompletedCount, -1);
    assert.equal(profileCompletedCount, 5);

    // Simula usuário clicando 10 vezes em toggle
    for (let i = 0; i < 10; i++) {
      profileCompletedCount = syncProfileCompletedCount(profileCompletedCount, 1);
      profileCompletedCount = syncProfileCompletedCount(profileCompletedCount, -1);
    }
    assert.equal(profileCompletedCount, 5, 'Contagem deve permanecer rigorosamente a mesma após 10 toggles');

    // Nunca desce abaixo de 0
    let zeroCount = 0;
    zeroCount = syncProfileCompletedCount(zeroCount, -1);
    assert.equal(zeroCount, 0, 'Não deve ficar negativa');
  });

  it('calculateTaskStats separa com precisão visão geral do espaço e produtividade de hoje', () => {
    const refDate = new Date(2026, 8, 24, 15, 0, 0); // 2026-09-24
    const todayStr = '2026-09-24';
    const yesterdayStr = '2026-09-23';
    const tomorrowStr = '2026-09-25';

    const testTodos: TodoItem[] = [
      // Tarefa 1: Agendada para hoje, concluída
      {
        id: '1',
        title: 'T1',
        dueDate: todayStr,
        completed: true,
        status: 'completed',
        completedAt: '2026-09-24T10:00:00.000Z',
        priority: 'high',
        category: 'work',
        pinned: false,
        pomodoros: 0,
        order: 0,
        createdAt: '2026-09-24T08:00:00.000Z',
        subTasks: [],
      },
      // Tarefa 2: Agendada para hoje, pendente
      {
        id: '2',
        title: 'T2',
        dueDate: todayStr,
        completed: false,
        status: 'todo',
        priority: 'medium',
        category: 'work',
        pinned: false,
        pomodoros: 0,
        order: 1,
        createdAt: '2026-09-24T08:00:00.000Z',
        subTasks: [],
      },
      // Tarefa 3: De ontem, não concluída (atrasada)
      {
        id: '3',
        title: 'T3',
        dueDate: yesterdayStr,
        completed: false,
        status: 'todo',
        priority: 'urgent',
        category: 'personal',
        pinned: false,
        pomodoros: 0,
        order: 2,
        createdAt: '2026-09-23T08:00:00.000Z',
        subTasks: [],
      },
      // Tarefa 4: De amanhã, não concluída
      {
        id: '4',
        title: 'T4',
        dueDate: tomorrowStr,
        completed: false,
        status: 'todo',
        priority: 'low',
        category: 'personal',
        pinned: false,
        pomodoros: 0,
        order: 3,
        createdAt: '2026-09-24T08:00:00.000Z',
        subTasks: [],
      },
      // Tarefa 5: Sem data, concluída no espaço
      {
        id: '5',
        title: 'T5',
        completed: true,
        status: 'completed',
        priority: 'medium',
        category: 'other',
        pinned: false,
        pomodoros: 0,
        order: 4,
        createdAt: '2026-09-20T08:00:00.000Z',
        subTasks: [],
      },
    ];

    const stats = calculateTaskStats(testTodos, refDate);

    // Métricas do Espaço:
    assert.equal(stats.total, 5, 'Total de tarefas no espaço');
    assert.equal(stats.completed, 2, 'Total de tarefas concluídas no espaço');
    assert.equal(stats.active, 3, 'Total de tarefas ativas no espaço');
    assert.equal(stats.rate, 40, 'Taxa de conclusão do espaço: 2/5 = 40%');

    // Métricas de Hoje (Fuso local):
    assert.equal(stats.todayTotal, 2, 'Total de tarefas para hoje (T1 e T2)');
    assert.equal(stats.todayPending, 1, 'Tarefas pendentes de hoje (T2)');
    assert.equal(stats.todayCompleted, 1, 'Tarefas de hoje concluídas (T1)');
    assert.equal(stats.overdue, 1, 'Tarefas atrasadas (T3)');
  });
});
