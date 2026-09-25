'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TodoItem, 
  TaskStatus, 
  UserProfile,
  AppSyncStatus,
  TaskGroup
} from '../types/todo';
import { 
  getContextId, 
  loadContextTodos, 
  saveContextTodos, 
  clearCompletedInContext,
  deleteTodoInContext,
  restoreTodoInContext,
  prepareDemoTodos,
  prepareImportTodos,
  loadSyncQueue,
  migrateGuestTasksToCloud,
  mergeCloudTasksWithLocal,
  getStorageKey,
} from '../utils/todoStorage';
import {
  transitionTaskStatus,
  toggleTaskCompleted,
  toggleSubTaskInTask,
  sanitizeTaskUpdates
} from '../utils/taskDomain';

import { stageTaskChanges, flushTaskChanges } from '../utils/taskPersistence';
import { useAuthSession } from './useAuthSession';
import { useUserGroups } from './useUserGroups';
import { useTaskFilters } from './useTaskFilters';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export function useTodos() {
  const { supabase, user, isAuthLoaded, signOut: authSignOut } = useAuthSession();
  const {
    groups,
    setGroups,
    currentGroupId,
    setCurrentGroupId,
    fetchCloudGroups,
    createGroup: rawCreateGroup,
    joinGroupByCode: rawJoinGroupByCode,
    leaveGroup: rawLeaveGroup,
    deleteGroup: rawDeleteGroup,
    fetchGroupMembers,
  } = useUserGroups(supabase, user?.id || null);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadedContext, setLoadedContext] = useState<string | null>(null);
  const currentContextId = getContextId(user?.id, currentGroupId);
  const profileRequestRef = useRef(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<AppSyncStatus>('synced');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // User Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Active context and request guard to prevent stale responses from overwriting current space
  const activeRequestIdRef = useRef<number>(0);
  const activeContextRef = useRef<string>('guest');

  // Last deleted task for undo
  const [lastDeletedTask, setLastDeletedTask] = useState<{
    task: TodoItem;
    contextId: string;
    index: number;
  } | null>(null);

  // Helper: map Supabase DB row to TodoItem
  interface SupabaseTaskRow {
    id: string;
    title: string;
    description?: string | null;
    completed: boolean;
    status?: TaskStatus;
    priority: TodoItem['priority'];
    category: TodoItem['category'];
    due_date?: string | null;
    due_time?: string | null;
    pinned: boolean;
    created_at: string;
    completed_at?: string | null;
    pomodoros?: number;
    pomodoro_session_ids?: string[];
    order_index?: number;
    order?: number;
    group_id?: string | null;
    created_by_name?: string | null;
    updated_at?: string;
    subtasks?: Array<{
      id: string;
      title: string;
      completed: boolean;
    }>;
  }

  const mapDbToTodo = useCallback((row: SupabaseTaskRow): TodoItem => {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      completed: row.completed,
      status: row.status || (row.completed ? 'completed' : 'todo'),
      priority: row.priority,
      category: row.category,
      dueDate: row.due_date || undefined,
      dueTime: row.due_time || undefined,
      pinned: row.pinned,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
      pomodoros: row.pomodoros || 0,
      pomodoroSessionIds: row.pomodoro_session_ids || [],
      order: row.order_index ?? row.order ?? 0,
      groupId: row.group_id || undefined,
      createdByName: row.created_by_name || undefined,
      syncState: 'synced',
      updatedAt: row.updated_at,
      subTasks: (row.subtasks || []).map((st) => ({
        id: st.id,
        title: st.title,
        completed: st.completed,
      })),
    };
  }, []);

  // Fetch user profile from Supabase
  const fetchUserProfile = useCallback(async (userObj: SupabaseUser) => {
    const request = ++profileRequestRef.current;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userObj.id)
        .single();

      if (request !== profileRequestRef.current) return;
      if (error && error.code !== 'PGRST116') {
        return;
      }

      if (data) {
        setProfile({
          id: data.id,
          email: data.email || userObj.email || '',
          displayName: data.display_name || userObj.email?.split('@')[0] || 'Usuário',
          avatarUrl: data.avatar_url || 'rocket',
          focusMinutes: data.focus_minutes || 0,
          completedTasksCount: data.completed_tasks_count || 0,
          updatedAt: data.updated_at,
        });
      } else {
        const initialProfile: UserProfile = {
          id: userObj.id,
          email: userObj.email || '',
          displayName: userObj.user_metadata?.full_name || userObj.email?.split('@')[0] || 'Usuário',
          avatarUrl: 'rocket',
          focusMinutes: 0,
          completedTasksCount: 0,
        };
        const { error: insErr } = await supabase.from('profiles').upsert({ id: initialProfile.id, email: initialProfile.email, display_name: initialProfile.displayName, avatar_url: initialProfile.avatarUrl, focus_minutes: 0, completed_tasks_count: 0 }, { onConflict: 'id', ignoreDuplicates: true });
        if (!insErr && request === profileRequestRef.current) {
          setProfile(initialProfile);
        }
      }
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
    }
  }, [supabase]);

  // Update user profile in Supabase
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const request = profileRequestRef.current;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: updates.displayName,
          avatar_url: updates.avatarUrl,
          focus_minutes: updates.focusMinutes,
          completed_tasks_count: updates.completedTasksCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      if (request === profileRequestRef.current) setProfile((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  }, [user, supabase]);

  const syncPendingQueue = useCallback(async (userId: string, targetGroupId: string | null) => {
    const context = getContextId(userId, targetGroupId);
    if (activeContextRef.current === context) {
      setIsSyncing(true);
      setSyncStatus('syncing');
      setPendingSyncCount(loadSyncQueue(userId, targetGroupId).length);
    }
    let failure: string | null = null;
    try {
      await flushTaskChanges(supabase, userId, targetGroupId);
    } catch (error) {
      failure = error instanceof Error ? error.message : 'Falha ao sincronizar. Suas alterações continuam salvas neste dispositivo.';
    }
    if (activeContextRef.current === context) {
      activeRequestIdRef.current++;
      const remaining = loadSyncQueue(userId, targetGroupId);
      setPendingSyncCount(remaining.length);
      setSyncStatus(failure ? 'error' : remaining.length ? 'syncing' : 'synced');
      setSyncError(failure);
      setIsSyncing(false);
      setTodos(loadContextTodos(userId, targetGroupId).todos);
      if (!failure && user?.id === userId) void fetchUserProfile(user);
    }
    return !failure;
  }, [supabase, user, fetchUserProfile]);

  // Carrega tarefas da nuvem (isoladas por usuário e grupo)
  const fetchCloudTodos = useCallback(
    async (userId: string, targetGroupId?: string | null) => {
      const activeGroup = targetGroupId !== undefined ? targetGroupId : currentGroupId;
      const targetContextId = getContextId(userId, activeGroup);
      if (activeContextRef.current !== targetContextId) return;

      activeRequestIdRef.current++;
      const currentRequestId = activeRequestIdRef.current;
      activeContextRef.current = targetContextId;

      setIsSyncing(true);

      const queue = loadSyncQueue(userId, activeGroup);
      setPendingSyncCount(queue.length);
      if (queue.length > 0) {
        setSyncStatus('error');
        setSyncError(`${queue.length} alteraç${queue.length > 1 ? 'ões pendentes' : 'ão pendente'} para envio.`);
      } else {
        setSyncStatus('synced');
        setSyncError(null);
      }

      const { todos: localCache } = loadContextTodos(userId, activeGroup);
      if (activeRequestIdRef.current === currentRequestId) {
        setTodos(localCache);
        if (localCache.length) setIsLoaded(true);
      }

      try {
        let query = supabase
          .from('tasks')
          .select(`
            id,
            title,
            description,
            completed,
            status,
            priority,
            category,
            due_date,
            due_time,
            pinned,
            created_at,
            completed_at,
            pomodoros,
            pomodoro_session_ids,
            order_index,
            group_id,
            created_by_name,
            updated_at,
            subtasks (
              id,
              title,
              completed
            )
          `)
          .order('order_index', { ascending: true });

        if (activeGroup) {
          query = query.eq('group_id', activeGroup);
        } else {
          query = query.eq('user_id', userId).is('group_id', null);
        }

        const { data, error } = await query;

        if (activeRequestIdRef.current !== currentRequestId) {
          return;
        }

        if (error) {
          setSyncStatus('error');
          setSyncError(error.message || 'Falha ao buscar dados na nuvem.');
          return;
        }

        if (data) {
          const cloudTodos: TodoItem[] = data.map(mapDbToTodo);
          const currentQueue = loadSyncQueue(userId, activeGroup);
          const merged = mergeCloudTasksWithLocal(loadContextTodos(userId, activeGroup).todos, cloudTodos, currentQueue);

          saveContextTodos(userId, activeGroup, merged);
          setTodos(merged);

          setLoadedContext(targetContextId);
          setIsLoaded(true);
          if (currentQueue.length > 0) {
            await syncPendingQueue(userId, activeGroup);
          } else {
            setSyncStatus('synced');
            setSyncError(null);
          }
        }
      } catch (err) {
        if (activeRequestIdRef.current === currentRequestId) {
          setSyncStatus('error');
          setSyncError(err instanceof Error ? err.message : 'Falha na comunicação de rede.');
        }
      } finally {
        if (activeRequestIdRef.current === currentRequestId) {
          setIsSyncing(false);
          setIsLoaded(true);
          setLoadedContext(targetContextId);
        }
      }
    },
    [supabase, currentGroupId, mapDbToTodo, syncPendingQueue]
  );

  // Tentativa explícita de nova sincronização
  const retrySync = useCallback(async () => {
    if (!user) return;
    const context = getContextId(user.id, currentGroupId);
    try {
      setIsSyncing(true);
      await syncPendingQueue(user.id, currentGroupId);
      if (activeContextRef.current !== context) return;
      await fetchCloudTodos(user.id, currentGroupId);
    } catch (err) {
      if (activeContextRef.current !== context) return;
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : 'Erro ao tentar sincronizar novamente.');
    } finally {
      if (activeContextRef.current === context) setIsSyncing(false);
    }
  }, [user, currentGroupId, syncPendingQueue, fetchCloudTodos]);

  useEffect(() => {
    if (!isAuthLoaded) return;
    let cancelled = false;
    const requests = activeRequestIdRef;
    const profiles = profileRequestRef;
    activeContextRef.current = getContextId(user?.id, currentGroupId);
    activeRequestIdRef.current++;
    profileRequestRef.current++;

    const load = async () => {
      try {
        if (user) {
          if (!currentGroupId) {
            const migration = await migrateGuestTasksToCloud(user.id, supabase);
            if (cancelled) return;
            if (!migration.success && migration.error) setSyncError(migration.error);
          }
          if (cancelled) return;
          await Promise.allSettled([fetchUserProfile(user), fetchCloudGroups(user.id), fetchCloudTodos(user.id, currentGroupId)]);
        } else {
          const guest = loadContextTodos(null, null).todos;
          if (cancelled) return;
          setProfile(null);
          setGroups([]);
          setTodos(guest);
          setSyncStatus('local_only');
          setPendingSyncCount(0);
          setSyncError(null);
          setIsLoaded(true);
          setLoadedContext('guest');
        }
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : 'Falha ao carregar as tarefas.');
          setSyncStatus('error');
        }
      }
    };
    void load();
    return () => { cancelled = true; requests.current++; profiles.current++; };
  }, [isAuthLoaded, user, currentGroupId, supabase, fetchCloudTodos, fetchUserProfile, fetchCloudGroups, setGroups]);

  useEffect(() => {
    const retry = () => { if (user) void retrySync(); };
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        if (user) void retrySync();
        else setTodos(loadContextTodos(null, null).todos);
      }
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', refresh); };
  }, [user, retrySync]);

  // Realtime subscription limpa e sem duplicidade para tarefas e membros
  useEffect(() => {
    if (!user) return;

    const currentContextId = getContextId(user.id, currentGroupId);
    const channelName = currentGroupId
      ? `realtime-group-${currentGroupId}`
      : `realtime-personal-${user.id}`;

    let channel = supabase.channel(channelName);

    if (currentGroupId) {
      channel = channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter: `group_id=eq.${currentGroupId}` },
          () => {
            if (activeContextRef.current === currentContextId) {
              fetchCloudTodos(user.id, currentGroupId);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'subtasks' },
          () => {
            if (activeContextRef.current === currentContextId) {
              fetchCloudTodos(user.id, currentGroupId);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${currentGroupId}` },
          (payload) => {
            if (payload.eventType === 'DELETE' && (payload.old as { user_id?: string })?.user_id === user.id) {
              setGroups((prev) => prev.filter((g) => g.id !== currentGroupId));
              setCurrentGroupId(null);
              return;
            }
            fetchCloudGroups(user.id);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${currentGroupId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setGroups((prev) => prev.filter((g) => g.id !== currentGroupId));
              setCurrentGroupId(null);
              return;
            }
            fetchCloudGroups(user.id);
          }
        );
    } else {
      channel = channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const newGroupId = (payload.new as { group_id?: string | null })?.group_id;
            const oldGroupId = (payload.old as { group_id?: string | null })?.group_id;
            if (!newGroupId || !oldGroupId) {
              if (activeContextRef.current === currentContextId) {
                fetchCloudTodos(user.id, null);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'subtasks' },
          () => {
            if (activeContextRef.current === currentContextId) {
              fetchCloudTodos(user.id, null);
            }
          }
        );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentGroupId, supabase, fetchCloudTodos, fetchCloudGroups, setGroups, setCurrentGroupId]);

  // Hook centralizado de filtros, busca e estatísticas
  const {
    filterStatus,
    setFilterStatus,
    filterCategory,
    setFilterCategory,
    filterPriority,
    setFilterPriority,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    filteredTodos,
    stats,
    todayDateStr,
  } = useTaskFilters(todos);

  // All mutations share the same durable outbox and atomic remote transaction.
  const persist = useCallback(async (next: TodoItem[], upserts: TodoItem[], deletes: string[] = []) => {
    const userId = user?.id || null;
    const context = getContextId(userId, currentGroupId);
    if (activeContextRef.current !== context || !isAuthLoaded) throw new Error('Aguarde o carregamento deste espaço.');
    try {
      const pendingIds = new Set(upserts.map(t => t.id));
      const prepared = next.map(t => pendingIds.has(t.id)
        ? { ...t, syncState: 'local_only' as const, syncError: undefined } : t);
      stageTaskChanges(userId, currentGroupId, prepared, upserts, deletes);
      activeRequestIdRef.current++; // An earlier read must not overwrite this write.
      setTodos(prepared);
      if (user) return await syncPendingQueue(user.id, currentGroupId);
      setSyncStatus('local_only');
      setSyncError(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a alteração.';
      setSyncStatus('error');
      setSyncError(message);
      throw error;
    }
  }, [user, currentGroupId, isAuthLoaded, syncPendingQueue]);

  const readCurrent = useCallback(() => loadContextTodos(user?.id, currentGroupId).todos, [user?.id, currentGroupId]);

  const addTodo = useCallback(async (taskData: Omit<TodoItem, 'id' | 'createdAt' | 'completed'>) => {
    const current = readCurrent();
    const now = new Date().toISOString();
    const newTask: TodoItem = {
      ...taskData, id: crypto.randomUUID(), createdAt: now, updatedAt: now,
      completed: taskData.status === 'completed', completedAt: taskData.status === 'completed' ? now : undefined,
      status: taskData.status || 'todo', pomodoros: 0, order: current.length,
      groupId: currentGroupId || undefined,
      createdByName: profile?.displayName || user?.email?.split('@')[0],
      subTasks: taskData.subTasks || [],
    };
    await persist([newTask, ...current], [newTask]);
  }, [readCurrent, currentGroupId, profile, user, persist]);

  const updateTodo = useCallback(async (id: string, updates: Partial<Omit<TodoItem, 'id' | 'createdAt'>>) => {
    const current = readCurrent();
    const original = current.find(t => t.id === id);
    if (!original) return;
    const { cleanUpdates } = sanitizeTaskUpdates(updates, original);
    const updated = { ...original, ...cleanUpdates };
    await persist(current.map(t => t.id === id ? updated : t), [updated]);

  }, [readCurrent, persist]);

  const toggleTodo = useCallback(async (id: string) => {
    const task = readCurrent().find(t => t.id === id);
    if (task) await updateTodo(id, toggleTaskCompleted(task));
  }, [readCurrent, updateTodo]);
  const moveTaskStatus = useCallback(async (id: string, status: TaskStatus) => {
    const task = readCurrent().find(t => t.id === id);
    if (task) await updateTodo(id, transitionTaskStatus(task, status));
  }, [readCurrent, updateTodo]);
  const togglePin = useCallback(async (id: string) => {
    const task = readCurrent().find(t => t.id === id);
    if (task) await updateTodo(id, { pinned: !task.pinned });
  }, [readCurrent, updateTodo]);
  const deleteTodo = useCallback(async (id: string) => {
    const { remaining, deletedTask, index } = deleteTodoInContext(readCurrent(), id);
    if (!deletedTask) return;
    setLastDeletedTask({ task: deletedTask, contextId: getContextId(user?.id, currentGroupId), index });
    await persist(remaining, [], [id]);
  }, [readCurrent, user?.id, currentGroupId, persist]);
  const undoDeleteTodo = useCallback(async () => {
    if (!lastDeletedTask || lastDeletedTask.contextId !== getContextId(user?.id, currentGroupId)) return;
    const restored = { ...lastDeletedTask.task, updatedAt: new Date().toISOString() };
    await persist(restoreTodoInContext(readCurrent(), restored, lastDeletedTask.index), [restored]);
    setLastDeletedTask(null);
  }, [lastDeletedTask, user?.id, currentGroupId, readCurrent, persist]);
  const clearDeletedHistory = useCallback(() => setLastDeletedTask(null), []);
  const addSubTask = useCallback(async (id: string, title: string) => {
    const task = readCurrent().find(t => t.id === id);
    if (task) await updateTodo(id, { subTasks: [...task.subTasks, { id: crypto.randomUUID(), title, completed: false }] });
  }, [readCurrent, updateTodo]);
  const toggleSubTask = useCallback(async (id: string, subId: string) => {
    const task = readCurrent().find(t => t.id === id);
    if (task) await updateTodo(id, toggleSubTaskInTask(task, subId).updatedTask);
  }, [readCurrent, updateTodo]);
  const deleteSubTask = useCallback(async (id: string, subId: string) => {
    const task = readCurrent().find(t => t.id === id);
    if (task) await updateTodo(id, { subTasks: task.subTasks.filter(st => st.id !== subId) });
  }, [readCurrent, updateTodo]);
  const clearCompleted = useCallback(async () => {
    const { remaining, removed } = clearCompletedInContext(readCurrent());
    await persist(remaining, [], removed.map(t => t.id));
  }, [readCurrent, persist]);

  const replaceList = useCallback(async (next: TodoItem[]) => {
    const before = readCurrent();
    // Recoverable snapshot before any bulk replacement.
    localStorage.setItem(`${getStorageKey(user?.id, currentGroupId)}_before_import`, JSON.stringify(before));
    const ids = new Set(next.map(t => t.id));
    const success = await persist(next, next, before.filter(t => !ids.has(t.id)).map(t => t.id));
    return { synced: success, localOnly: !user };
  }, [readCurrent, user, currentGroupId, persist]);
  const resetToDemo = useCallback(async (mode: 'append' | 'replace' = 'append') => {
    return replaceList(prepareDemoTodos(readCurrent(), mode, currentGroupId));
  }, [readCurrent, currentGroupId, replaceList]);
  const importTodos = useCallback(async (items: TodoItem[], mode: 'merge' | 'replace') => {
    return replaceList(prepareImportTodos(readCurrent(), items, mode, currentGroupId));
  }, [readCurrent, currentGroupId, replaceList]);
  const reorderTodos = useCallback(async (ordered: TodoItem[]) => {
    const next = ordered.map((task, order) => ({ ...task, order, updatedAt: new Date().toISOString() }));
    await persist(next, next);
  }, [persist]);
  const incrementPomodoro = useCallback(async (id: string, sessionId: string) => {
    const task = readCurrent().find(t => t.id === id);
    if (!task || task.pomodoroSessionIds?.includes(sessionId)) return;
    await updateTodo(id, { pomodoros: (task.pomodoros || 0) + 1, pomodoroSessionIds: [...(task.pomodoroSessionIds || []), sessionId] });
  }, [readCurrent, updateTodo]);
  const signOut = useCallback(async () => {
    await authSignOut();
    activeRequestIdRef.current++;
    profileRequestRef.current++;
    activeContextRef.current = 'guest';
    setProfile(null);
    setGroups([]);
    setCurrentGroupId(null);
  }, [authSignOut, setGroups, setCurrentGroupId]);

  const createGroup = useCallback(
    async (name: string, description?: string, color?: string): Promise<TaskGroup> => {
      if (!user) throw new Error('É necessário estar autenticado para criar um grupo.');
      return rawCreateGroup(user.id, name, description, color);
    },
    [user, rawCreateGroup]
  );

  const joinGroupByCode = useCallback(
    async (code: string): Promise<{ success: boolean; message: string }> => {
      if (!user) throw new Error('É necessário estar autenticado para entrar em um grupo.');
      try {
        const joined = await rawJoinGroupByCode(user.id, code);
        return { success: true, message: `Você entrou no grupo "${joined.name}"!` };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao entrar no grupo.';
        return { success: false, message: msg };
      }
    },
    [user, rawJoinGroupByCode]
  );

  const leaveGroup = useCallback(
    async (groupId: string): Promise<void> => {
      if (!user) return;
      return rawLeaveGroup(user.id, groupId);
    },
    [user, rawLeaveGroup]
  );

  const deleteGroup = useCallback(
    async (groupId: string): Promise<void> => {
      if (!user) return;
      return rawDeleteGroup(user.id, groupId);
    },
    [user, rawDeleteGroup]
  );

  return {
    todos: loadedContext === currentContextId ? todos : [],
    filteredTodos: loadedContext === currentContextId ? filteredTodos : [],
    isLoaded: isLoaded && loadedContext === currentContextId,
    contextId: currentContextId,
    todayDateStr,
    user,
    isSyncing,
    refetchCloud: () => user && fetchCloudTodos(user.id, currentGroupId),
    stats,
    viewMode,
    setViewMode,
    filterStatus,
    setFilterStatus,
    filterCategory,
    setFilterCategory,
    filterPriority,
    setFilterPriority,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    addTodo,
    updateTodo,
    toggleTodo,
    togglePin,
    deleteTodo,
    toggleSubTask,
    addSubTask,
    deleteSubTask,
    clearCompleted,
    resetToDemo,
    moveTaskStatus,
    reorderTodos,
    incrementPomodoro,
    importTodos,
    getPreviousBackup: () => {
      try {
        const raw = localStorage.getItem(`${getStorageKey(user?.id, currentGroupId)}_before_import`);
        return raw ? JSON.parse(raw) as TodoItem[] : null;
      } catch { return null; }
    },
    profile: profile?.id === user?.id ? profile : null,
    updateProfile,
    groups,
    currentGroupId,
    setCurrentGroupId,
    createGroup,
    joinGroupByCode,
    leaveGroup,
    deleteGroup,
    fetchGroupMembers,
    signOut,
    undoDeleteTodo,
    lastDeletedTask,
    clearDeletedHistory,
    syncStatus,
    syncError,
    pendingSyncCount,
    retrySync,
  };
}
