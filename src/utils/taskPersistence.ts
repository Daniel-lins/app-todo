import type { TodoItem } from '../types/todo';
import {
  getContextId, loadContextTodos, saveContextTodos, loadSyncQueue, saveSyncQueue,
  type PendingSyncItem, type StorageLike,
} from './todoStorage';

export interface TaskTransport {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
}

export function taskPayload(task: TodoItem, userId: string, groupId: string | null) {
  return {
    id: task.id, user_id: userId, group_id: groupId, title: task.title,
    description: task.description || null, completed: task.completed,
    status: task.status || (task.completed ? 'completed' : 'todo'),
    priority: task.priority, category: task.category, due_date: task.dueDate || null,
    due_time: task.dueTime || null, pinned: task.pinned, pomodoros: task.pomodoros || 0,
    pomodoro_session_ids: task.pomodoroSessionIds || [],
    order_index: task.order || 0, created_at: task.createdAt,
    completed_at: task.completedAt || null, updated_at: task.updatedAt || task.createdAt,
    created_by_name: task.createdByName || null,
  };
}

/** The entire batch (including removals of subtasks) commits or rolls back together. */
export async function sendTaskChanges(
  client: TaskTransport, userId: string, groupId: string | null, operations: PendingSyncItem[],
) {
  const { error } = await client.rpc('apply_task_changes', {
    p_group_id: groupId,
    p_changes: operations.map(op => ({
      action: op.action, id: op.taskId,
      task: op.task ? taskPayload(op.task, userId, groupId) : null,
      subtasks: op.task?.subTasks.map(st => ({ ...st, task_id: op.taskId })) || [],
    })),
  });
  if (error) throw new Error(error.message);
}

/** Persist the full outbox before presenting an optimistic result. */
export function stageTaskChanges(
  userId: string | null, groupId: string | null, next: TodoItem[],
  upserts: TodoItem[], deletes: string[], storage?: StorageLike,
) {
  if (userId) {
    const changed = new Set([...upserts.map(t => t.id), ...deletes]);
    const contextId = getContextId(userId, groupId);
    const operations: PendingSyncItem[] = [
      ...upserts.map(task => ({ taskId: task.id, action: 'upsert' as const, task })),
      ...deletes.map(taskId => ({ taskId, action: 'delete' as const })),
    ].map(op => ({ ...op, id: crypto.randomUUID(), contextId, timestamp: Date.now(), retryCount: 0 }));
    saveSyncQueue(userId, groupId, [
      ...loadSyncQueue(userId, groupId, storage).filter(op => !changed.has(op.taskId)), ...operations,
    ], storage);
  }
  saveContextTodos(userId, groupId, next, storage);
}

const flights = new Map<string, Promise<void>>();

/** One writer per context; acknowledge operation IDs so a newer edit survives an old response. */
export function flushTaskChanges(
  client: TaskTransport, userId: string, groupId: string | null, storage?: StorageLike,
): Promise<void> {
  const context = getContextId(userId, groupId);
  const existing = flights.get(context);
  if (existing) return existing;
  const drain = async () => {
    while (true) {
      const batch = loadSyncQueue(userId, groupId, storage);
      if (!batch.length) return;
      await sendTaskChanges(client, userId, groupId, batch);
      const acknowledged = new Set(batch.map(op => op.id));
      const remaining = loadSyncQueue(userId, groupId, storage).filter(op => !acknowledged.has(op.id));
      saveSyncQueue(userId, groupId, remaining, storage);
      const pending = new Set(remaining.map(op => op.taskId));
      const saved = new Set(batch.filter(op => op.action === 'upsert').map(op => op.taskId));
      const cache = loadContextTodos(userId, groupId, storage).todos.map(task =>
        saved.has(task.id) && !pending.has(task.id)
          ? { ...task, syncState: 'synced' as const, syncError: undefined } : task);
      saveContextTodos(userId, groupId, cache, storage);
    }
  };
  const run = Promise.resolve(typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(`apptodo-sync-${context}`, drain) : drain());
  const flight = run.finally(() => { flights.delete(context); });
  flights.set(context, flight);
  return flight;
}
