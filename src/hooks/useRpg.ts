'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { TodoItem, Category, Priority } from '../types/todo';
import { calculateRpgStats, calculateLevelFromXp, getTaskCompletionReward } from '../utils/rpgService';
import { historyKey, mergeRpgHistory, parseRpgHistory, readRpgHistory, saveRpgHistory } from '../utils/rpgHistory';
import { loadContextTodos, loadSyncQueue } from '../utils/todoStorage';
import { createClient } from '../utils/supabase/client';

function subscribeHistory(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('apptodo-rpg-history', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('apptodo-rpg-history', callback);
  };
}

export function useRpg({ todos, userId, groupId, contextId, isLoaded, syncStatus }: {
  todos: TodoItem[]; userId: string | null; groupId: string | null;
  contextId: string; isLoaded: boolean; syncStatus: string;
}) {
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false);
  const [notice, setNotice] = useState<{ context: string; xp: number; areaName: string; level: number | null } | null>(null);
  const [historyError, setHistoryError] = useState<{ context: string; message: string } | null>(null);
  const key = historyKey(userId, groupId);
  const snapshot = useSyncExternalStore(subscribeHistory, () => {
    try { return localStorage.getItem(key) || '[]'; } catch { return '[]'; }
  }, () => '[]');
  const enabled = useSyncExternalStore(subscribeHistory, () => {
    try { return localStorage.getItem('apptodo_rpg_enabled') !== 'false'; } catch { return true; }
  }, () => true);
  const activeContext = useRef(contextId);
  useEffect(() => { activeContext.current = contextId; }, [contextId]);

  const rpgStats = useMemo(() => {
    return calculateRpgStats(mergeRpgHistory(parseRpgHistory(snapshot), isLoaded ? todos : []));
  }, [snapshot, todos, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        if (!userId) {
          saveRpgHistory(null, null, mergeRpgHistory(readRpgHistory(null, null), todos));
          return;
        }
        const client = createClient();
        const remote: TodoItem[] = [];
        for (let offset = 0; ; offset += 1000) {
          let query = client.from('rpg_task_history').select('task_id,category,priority,completed,completed_subtasks,pomodoros').order('task_id').range(offset, offset + 999);
          query = groupId ? query.eq('group_id', groupId) : query.eq('user_id', userId).is('group_id', null);
          const { data, error } = await query;
          if (cancelled) return;
          if (error) throw error;
          for (const row of data || []) remote.push({
            id: row.task_id, title: '', createdAt: '', pinned: false,
            category: row.category as Category, priority: row.priority as Priority,
            completed: row.completed, pomodoros: row.pomodoros,
            subTasks: Array.from({ length: row.completed_subtasks }, (_, i) => ({ id: String(i), title: '', completed: true })),
          });
          if (!data || data.length < 1000) break;
        }
        if (cancelled) return;
        // Only pending local changes can override authoritative remote history.
        const pending = new Set(loadSyncQueue(userId, groupId).map(op => op.taskId));
        const local = readRpgHistory(userId, groupId).filter(t => pending.has(t.id));
        saveRpgHistory(userId, groupId, mergeRpgHistory(remote, local));
        setHistoryError(null);
      } catch {
        if (!cancelled) setHistoryError({ context: contextId, message: 'Não foi possível atualizar o histórico. O progresso disponível neste dispositivo continua visível.' });
      }
    };
    void refresh();
    const interval = userId ? setInterval(() => void refresh(), 30000) : undefined;
    return () => { cancelled = true; clearInterval(interval); };
  }, [todos, userId, groupId, contextId, isLoaded, syncStatus]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const rewardCompletion = useCallback((task: TodoItem, previousXp: number) => {
    if (!enabled || activeContext.current !== contextId) return;
    const current = loadContextTodos(userId, groupId).todos;
    if (!current.find(t => t.id === task.id)?.completed) return;
    const after = calculateRpgStats(mergeRpgHistory(readRpgHistory(userId, groupId), current));
    const oldLevel = calculateLevelFromXp(previousXp).level;
    const reward = getTaskCompletionReward(task);
    setNotice({ context: contextId, xp: reward.xp, areaName: reward.areaName,
      level: after.level > oldLevel ? after.level : null });
  }, [enabled, contextId, userId, groupId]);

  const setEnabled = useCallback((value: boolean) => {
    localStorage.setItem('apptodo_rpg_enabled', String(value));
    window.dispatchEvent(new Event('apptodo-rpg-history'));
    setIsCharacterSheetOpen(false);
    setNotice(null);
  }, []);

  return { rpgStats, enabled, setEnabled, historyError: historyError?.context === contextId ? historyError.message : null,
    isCharacterSheetOpen: enabled && isCharacterSheetOpen,
    setIsCharacterSheetOpen, rewardCompletion,
    notice: enabled && notice?.context === contextId ? notice : null,
    dismissNotice: () => setNotice(null) };
}
