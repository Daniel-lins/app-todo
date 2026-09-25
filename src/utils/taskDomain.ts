/**
 * Regras de domínio centrais para tarefas, subtarefas e métricas.
 * Garante consistência absoluta entre completed, status, completedAt,
 * limpeza de campos opcionais e sincronização entre Lista e Kanban.
 */

import { TodoItem, TaskStatus, TaskStats } from '../types/todo';
import { getLocalDateString, isTodayLocal, isOverdueLocal } from './dateUtils';

/**
 * Transiciona o status de uma tarefa garantindo coerência com 'completed' e 'completedAt'.
 * Usado pelo Kanban e por ações de workflow.
 */
export function transitionTaskStatus(
  task: TodoItem,
  newStatus: TaskStatus,
  nowISO = new Date().toISOString()
): TodoItem {
  const willComplete = newStatus === 'completed';

  return {
    ...task,
    status: newStatus,
    completed: willComplete,
    completedAt: willComplete ? (task.completedAt || nowISO) : undefined,
    updatedAt: nowISO,
    // Se a tarefa principal foi concluída, conclui todas as subtarefas
    subTasks: willComplete
      ? task.subTasks.map((st) => ({ ...st, completed: true }))
      : task.subTasks,
  };
}

/**
 * Alterna a conclusão de uma tarefa (concluir / reabrir).
 * Garante que reabrir NUNCA mantenha o status como 'completed' nem na coluna de concluídas.
 */
export function toggleTaskCompleted(
  task: TodoItem,
  nowISO = new Date().toISOString()
): TodoItem {
  const willComplete = !task.completed;

  if (willComplete) {
    return {
      ...task,
      completed: true,
      status: 'completed',
      completedAt: nowISO,
      updatedAt: nowISO,
      subTasks: task.subTasks.map((st) => ({ ...st, completed: true })),
    };
  }

  // Reabertura: status passa para 'todo', completedAt é limpo
  return {
    ...task,
    completed: false,
    status: 'todo',
    completedAt: undefined,
    updatedAt: nowISO,
    // Subtarefas continuam intactas
    subTasks: task.subTasks,
  };
}

/**
 * Alterna a conclusão de uma subtarefa e atualiza coherentemente a tarefa principal.
 * - Se todas as subtarefas forem concluídas: a tarefa principal se torna 'completed'.
 * - Se a tarefa principal estava 'completed' e uma subtarefa for reaberta: a tarefa principal reabre para 'in_progress'.
 */
export function toggleSubTaskInTask(
  task: TodoItem,
  subTaskId: string,
  nowISO = new Date().toISOString()
): {
  updatedTask: TodoItem;
  subTaskCompleted: boolean;
  parentCompletedChanged: boolean;
  newParentCompleted: boolean;
} {
  let subTaskCompleted = false;

  const updatedSubs = task.subTasks.map((st) => {
    if (st.id === subTaskId) {
      subTaskCompleted = !st.completed;
      return { ...st, completed: subTaskCompleted };
    }
    return st;
  });

  const allCompleted = updatedSubs.length > 0 && updatedSubs.every((st) => st.completed);
  const anyCompleted = updatedSubs.some((st) => st.completed);

  let newParentCompleted = task.completed;
  let newStatus = task.status || 'todo';
  let newCompletedAt = task.completedAt;

  if (allCompleted) {
    newParentCompleted = true;
    newStatus = 'completed';
    newCompletedAt = task.completedAt || nowISO;
  } else if (task.completed && !subTaskCompleted) {
    // Subtarefa foi reaberta em uma tarefa que estava concluída
    newParentCompleted = false;
    newStatus = anyCompleted ? 'in_progress' : 'todo';
    newCompletedAt = undefined;
  }

  const parentCompletedChanged = newParentCompleted !== task.completed;

  const updatedTask: TodoItem = {
    ...task,
    subTasks: updatedSubs,
    completed: newParentCompleted,
    status: newStatus,
    completedAt: newCompletedAt,
    updatedAt: nowISO,
  };

  return {
    updatedTask,
    subTaskCompleted,
    parentCompletedChanged,
    newParentCompleted,
  };
}

/**
 * Higieniza as atualizações de uma tarefa diferenciando campo não alterado de campo removido.
 * Retorna os dados limpos para o estado local e o dicionário de campos para o Supabase (com `null` explícito).
 */
export function sanitizeTaskUpdates(
  updates: Partial<TodoItem>,
  currentTask?: TodoItem,
  nowISO = new Date().toISOString()
): {
  cleanUpdates: Partial<TodoItem>;
  dbUpdates: Record<string, unknown>;
} {
  const cleanUpdates: Partial<TodoItem> = { updatedAt: nowISO };
  const dbUpdates: Record<string, unknown> = { updated_at: nowISO };

  if ('title' in updates && updates.title !== undefined) {
    const cleanTitle = updates.title.trim();
    cleanUpdates.title = cleanTitle;
    dbUpdates.title = cleanTitle;
  }

  // Descrição: distingue não informada vs removida
  if ('description' in updates) {
    const val = updates.description ? updates.description.trim() : null;
    cleanUpdates.description = val || undefined;
    dbUpdates.description = val; // Envia null explícito para o Supabase limpar no banco!
  }

  // Data de vencimento: distingue não informada vs removida
  if ('dueDate' in updates) {
    const val = updates.dueDate ? updates.dueDate.trim() : null;
    cleanUpdates.dueDate = val || undefined;
    dbUpdates.due_date = val; // Envia null explícito para o Supabase limpar no banco!
  }

  // Horário de vencimento: distingue não informada vs removida
  if ('dueTime' in updates) {
    const val = updates.dueTime ? updates.dueTime.trim() : null;
    cleanUpdates.dueTime = val || undefined;
    dbUpdates.due_time = val; // Envia null explícito para o Supabase limpar no banco!
  }

  // Prioridade e Categoria
  if ('priority' in updates && updates.priority !== undefined) {
    cleanUpdates.priority = updates.priority;
    dbUpdates.priority = updates.priority;
  }
  if ('category' in updates && updates.category !== undefined) {
    cleanUpdates.category = updates.category;
    dbUpdates.category = updates.category;
  }
  if ('pinned' in updates && updates.pinned !== undefined) {
    cleanUpdates.pinned = updates.pinned;
    dbUpdates.pinned = updates.pinned;
  }
  if ('pomodoros' in updates && updates.pomodoros !== undefined) {
    cleanUpdates.pomodoros = updates.pomodoros;
    dbUpdates.pomodoros = updates.pomodoros;
  }
  if (updates.pomodoroSessionIds) {
    cleanUpdates.pomodoroSessionIds = [...new Set(updates.pomodoroSessionIds)];
    dbUpdates.pomodoro_session_ids = cleanUpdates.pomodoroSessionIds;
  }
  if ('order' in updates && updates.order !== undefined) {
    cleanUpdates.order = updates.order;
    dbUpdates.order_index = updates.order;
  }

  // Status e Conclusão: regra central para nunca divergirem
  if ('status' in updates || 'completed' in updates) {
    const requestedStatus = updates.status ?? (updates.completed === false ? 'todo' : currentTask?.status);
    const requestedCompleted = updates.completed ?? (updates.status ? updates.status === 'completed' : currentTask?.completed);

    if (requestedStatus === 'completed' || requestedCompleted === true) {
      cleanUpdates.completed = true;
      cleanUpdates.status = 'completed';
      cleanUpdates.completedAt = updates.completedAt || currentTask?.completedAt || nowISO;
      dbUpdates.completed = true;
      dbUpdates.status = 'completed';
      dbUpdates.completed_at = cleanUpdates.completedAt;
    } else {
      cleanUpdates.completed = false;
      cleanUpdates.status = requestedStatus === 'in_progress' ? 'in_progress' : 'todo';
      cleanUpdates.completedAt = undefined;
      dbUpdates.completed = false;
      dbUpdates.status = cleanUpdates.status;
      dbUpdates.completed_at = null; // Envia null explícito ao reabrir!
    }
  }

  if ('subTasks' in updates && updates.subTasks !== undefined) {
    cleanUpdates.subTasks = updates.subTasks;
  }

  return { cleanUpdates, dbUpdates };
}

/**
 * Calcula estatísticas com separação explícita entre métricas do espaço e métricas do dia de hoje (no fuso local).
 */
export function calculateTaskStats(
  todos: TodoItem[],
  referenceDate: Date = new Date()
): TaskStats {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const active = total - completed;
  const pinned = todos.filter((t) => t.pinned && !t.completed).length;
  const urgent = todos.filter((t) => t.priority === 'urgent' && !t.completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const todayStr = getLocalDateString(referenceDate);

  // Tarefas agendadas para hoje
  const todayTasks = todos.filter((t) => isTodayLocal(t.dueDate, referenceDate));
  const todayTotal = todayTasks.length;
  const todayPending = todayTasks.filter((t) => !t.completed).length;

  // Tarefas concluídas hoje (ou agendadas para hoje que foram concluídas, ou concluídas na data de hoje)
  const todayCompleted = todos.filter((t) => {
    if (!t.completed) return false;
    // Se foi concluída hoje pelo completedAt
    if (t.completedAt && isTodayLocal(t.completedAt, referenceDate)) {
      return true;
    }
    // Ou se estava agendada para hoje e está concluída
    if (t.dueDate === todayStr) {
      return true;
    }
    return false;
  }).length;

  // Tarefas atrasadas (prazo estritamente anterior a hoje e ainda não concluídas)
  const overdue = todos.filter((t) => isOverdueLocal(t.dueDate, referenceDate) && !t.completed).length;

  return {
    total,
    completed,
    active,
    pinned,
    urgent,
    rate,
    todayTotal,
    todayCompleted,
    todayPending,
    todayCount: todayPending, // Retrocompatibilidade
    overdue,
  };
}

/**
 * Ajusta a contagem de tarefas concluídas do perfil evitando duplicações por concluir/reabrir.
 */
export function syncProfileCompletedCount(currentCount = 0, delta: number): number {
  return Math.max(0, currentCount + delta);
}
