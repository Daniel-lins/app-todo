import type { TodoItem } from '../types/todo';
import { getStorageKey, type StorageLike } from './todoStorage';

// Retain only reward evidence, never the deleted task's title or description.
export function rewardSnapshot(task: TodoItem): TodoItem {
  return {
    id: task.id, title: '', createdAt: '', pinned: false,
    completed: task.completed, category: task.category, priority: task.priority,
    pomodoros: task.pomodoros || 0,
    subTasks: task.subTasks.filter(s => s.completed).map((_, i) => ({ id: String(i), title: '', completed: true })),
  };
}

export function historyKey(userId: string | null, groupId: string | null) {
  return `${getStorageKey(userId, groupId)}_rpg_history_v1`;
}

export function readRpgHistory(userId: string | null, groupId: string | null, storage?: StorageLike): TodoItem[] {
  try { return parseRpgHistory((storage || localStorage).getItem(historyKey(userId, groupId)) || '[]'); }
  catch { return []; }
}

export function parseRpgHistory(raw: string): TodoItem[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((t): t is TodoItem => !!t && typeof t.id === 'string'
      && typeof t.completed === 'boolean'
      && ['low','medium','high','urgent'].includes(t.priority)
      && ['work','study','health','finance','personal','other'].includes(t.category)
      && Number.isFinite(t.pomodoros) && t.pomodoros >= 0
      && Array.isArray(t.subTasks) && t.subTasks.every((s: unknown) => !!s && typeof s === 'object' && 'completed' in s && typeof s.completed === 'boolean'));
  } catch { return []; }
}

export function mergeRpgHistory(history: TodoItem[], tasks: TodoItem[]): TodoItem[] {
  const records = new Map(history.map(t => [t.id, t]));
  for (const task of tasks) records.set(task.id, rewardSnapshot(task));
  return [...records.values()];
}

export function saveRpgHistory(userId: string | null, groupId: string | null, records: TodoItem[], storage?: StorageLike) {
  try { (storage || localStorage).setItem(historyKey(userId, groupId), JSON.stringify(records)); }
  catch (cause) { throw new Error('Não foi possível preservar a fila de progresso neste dispositivo.', { cause }); }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('apptodo-rpg-history'));
}
