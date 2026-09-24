'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TodoItem, 
  TaskStatus, 
  UserProfile,
  AppSyncStatus,
  TaskGroup,
  TaskSyncState
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
  enqueueSyncItem,
  dequeueSyncItem,
  mergeCloudTasksWithLocal,
  syncPendingItemToCloud,
  SupabaseClientWithErrors
} from '../utils/todoStorage';
import {
  transitionTaskStatus,
  toggleTaskCompleted,
  toggleSubTaskInTask,
  sanitizeTaskUpdates,
  syncProfileCompletedCount
} from '../utils/taskDomain';

import { useAuthSession } from './useAuthSession';
import { useUserGroups } from './useUserGroups';
import { useTaskFilters } from './useTaskFilters';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export function useTodos() {
  const { supabase, user, setUser, signOut: authSignOut } = useAuthSession();
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
  } = useUserGroups(supabase);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
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
      order: row.order || 0,
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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userObj.id)
        .single();

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
        const { error: insErr } = await supabase.from('profiles').insert(initialProfile);
        if (!insErr) {
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

      setProfile((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  }, [user, supabase]);

  // Sincroniza a fila offline pendente com a nuvem
  const syncPendingQueue = useCallback(async (userId: string, targetGroupId: string | null) => {
    const queue = loadSyncQueue(userId, targetGroupId);
    if (queue.length === 0) {
      setSyncStatus('synced');
      setPendingSyncCount(0);
      setSyncError(null);
      return;
    }

    setIsSyncing(true);
    setSyncStatus('syncing');
    let hasFailures = false;
    let lastErrorMsg: string | null = null;

    for (const item of queue) {
      const result = await syncPendingItemToCloud(item, userId, targetGroupId, supabase as unknown as SupabaseClientWithErrors);
      if (result.success) {
        dequeueSyncItem(userId, targetGroupId, item.id);
      } else {
        hasFailures = true;
        lastErrorMsg = result.error || 'Erro ao sincronizar item pendente.';
        break;
      }
    }

    const remainingQueue = loadSyncQueue(userId, targetGroupId);
    setPendingSyncCount(remainingQueue.length);

    if (hasFailures) {
      setSyncStatus('error');
      setSyncError(lastErrorMsg);
    } else {
      setSyncStatus('synced');
      setSyncError(null);
    }
    setIsSyncing(false);
  }, [supabase]);

  // Carrega tarefas da nuvem (isoladas por usuário e grupo)
  const fetchCloudTodos = useCallback(
    async (userId: string, targetGroupId?: string | null) => {
      const activeGroup = targetGroupId !== undefined ? targetGroupId : currentGroupId;
      const targetContextId = getContextId(userId, activeGroup);

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
        setIsLoaded(true);
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
            order,
            group_id,
            created_by_name,
            updated_at,
            subtasks (
              id,
              title,
              completed
            )
          `)
          .order('order', { ascending: true });

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
          const merged = mergeCloudTasksWithLocal(cloudTodos, localCache, currentQueue);

          saveContextTodos(userId, activeGroup, merged);
          setTodos(merged);

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
        }
      }
    },
    [supabase, currentGroupId, mapDbToTodo, syncPendingQueue]
  );

  // Tentativa explícita de nova sincronização
  const retrySync = useCallback(async () => {
    if (!user) return;
    try {
      setIsSyncing(true);
      await syncPendingQueue(user.id, currentGroupId);
      await fetchCloudTodos(user.id, currentGroupId);
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : 'Erro ao tentar sincronizar novamente.');
    } finally {
      setIsSyncing(false);
    }
  }, [user, currentGroupId, syncPendingQueue, fetchCloudTodos]);

  // Carregamento de tarefas unificado e sem duplicidade ao trocar de contexto (visitante / conta / grupo)
  useEffect(() => {
    let isCancelled = false;

    const loadContext = async () => {
      if (user) {
        await Promise.allSettled([
          fetchUserProfile(user),
          fetchCloudGroups(user.id),
          fetchCloudTodos(user.id, currentGroupId),
        ]);
      } else {
        activeRequestIdRef.current++;
        activeContextRef.current = 'guest';
        const { todos: guestTodos } = loadContextTodos(null, null);
        if (!isCancelled) {
          setProfile(null);
          setTodos(guestTodos);
          setIsLoaded(true);
          setSyncStatus('local_only');
          setPendingSyncCount(0);
          setSyncError(null);
        }
      }
    };

    void loadContext();

    return () => {
      isCancelled = true;
    };
  }, [user, currentGroupId, fetchCloudTodos, fetchUserProfile, fetchCloudGroups]);

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
  } = useTaskFilters(todos);

  // Operações de Tarefas: Adicionar
  const addTodo = useCallback(
    async (taskData: Omit<TodoItem, 'id' | 'createdAt' | 'completed'>) => {
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const targetGroupId = currentGroupId;
      const currentUserId = user?.id || null;

      const newTask: TodoItem = {
        id: newId,
        title: taskData.title,
        description: taskData.description,
        completed: false,
        status: taskData.status || 'todo',
        priority: taskData.priority,
        category: taskData.category,
        dueDate: taskData.dueDate,
        dueTime: taskData.dueTime,
        pinned: taskData.pinned,
        subTasks: taskData.subTasks || [],
        createdAt: now,
        pomodoros: 0,
        order: todos.length,
        groupId: targetGroupId || undefined,
        createdByName: profile?.displayName || user?.email?.split('@')[0] || undefined,
        syncState: user ? 'syncing' : 'local_only',
      };

      setTodos((prev) => {
        const next = [newTask, ...prev];
        saveContextTodos(currentUserId, targetGroupId, next);
        return next;
      });

      if (user) {
        try {
          const { error: taskErr } = await supabase.from('tasks').insert({
            id: newTask.id,
            user_id: user.id,
            group_id: targetGroupId,
            title: newTask.title,
            description: newTask.description || null,
            completed: false,
            status: newTask.status,
            priority: newTask.priority,
            category: newTask.category,
            due_date: newTask.dueDate || null,
            due_time: newTask.dueTime || null,
            pinned: newTask.pinned,
            created_at: newTask.createdAt,
            pomodoros: 0,
            order: newTask.order,
            created_by_name: newTask.createdByName || null,
          });

          if (taskErr) throw new Error(taskErr.message);

          if (newTask.subTasks.length > 0) {
            const subPayloads = newTask.subTasks.map((st) => ({
              id: st.id,
              task_id: newTask.id,
              title: st.title,
              completed: st.completed,
            }));
            const { error: subErr } = await supabase.from('subtasks').insert(subPayloads);
            if (subErr) throw new Error(subErr.message);
          }

          setTodos((prev) =>
            prev.map((t) => (t.id === newTask.id ? { ...t, syncState: 'synced', syncError: undefined } : t))
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Falha ao sincronizar na nuvem.';
          enqueueSyncItem(user.id, targetGroupId, {
            taskId: newTask.id,
            action: 'upsert',
            contextId: targetGroupId || user.id,
            task: newTask,
          });
          setTodos((prev) =>
            prev.map((t) => (t.id === newTask.id ? { ...t, syncState: 'error', syncError: errMsg } : t))
          );
          setSyncStatus('error');
          setSyncError(errMsg);
          setPendingSyncCount((c) => c + 1);
        }
      }
    },
    [currentGroupId, user, profile, todos.length, supabase]
  );

  // Operações de Tarefas: Atualizar
  const updateTodo = useCallback(
    async (id: string, updates: Partial<Omit<TodoItem, 'id' | 'createdAt'>>) => {
      const currentUserId = user?.id || null;
      const targetGroupId = currentGroupId;
      const existingTask = todos.find((t) => t.id === id);
      if (!existingTask) return;

      const { cleanUpdates, dbUpdates } = sanitizeTaskUpdates(updates, existingTask);

      const nextSyncState: TaskSyncState = user ? 'syncing' : 'local_only';
      setTodos((prev) => {
        const next: TodoItem[] = prev.map((t) => (t.id === id ? { ...t, ...cleanUpdates, syncState: nextSyncState } : t));
        saveContextTodos(currentUserId, targetGroupId, next);
        return next;
      });

      if (user) {
        try {
          if (Object.keys(dbUpdates).length > 0) {
            const { error: taskErr } = await supabase.from('tasks').update(dbUpdates).eq('id', id);
            if (taskErr) throw new Error(taskErr.message);
          }

          if (updates.subTasks !== undefined) {
            await supabase.from('subtasks').delete().eq('task_id', id);
            if (updates.subTasks.length > 0) {
              const subPayloads = updates.subTasks.map((st) => ({
                id: st.id,
                task_id: id,
                title: st.title,
                completed: st.completed,
              }));
              const { error: subErr } = await supabase.from('subtasks').insert(subPayloads);
              if (subErr) throw new Error(subErr.message);
            }
          }

          setTodos((prev) =>
            prev.map((t) => (t.id === id ? { ...t, syncState: 'synced', syncError: undefined } : t))
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Falha ao sincronizar atualização.';
          enqueueSyncItem(user.id, targetGroupId, {
            taskId: id,
            action: 'upsert',
            contextId: targetGroupId || user.id,
            task: { ...existingTask, ...cleanUpdates },
          });
          setTodos((prev) =>
            prev.map((t) => (t.id === id ? { ...t, syncState: 'error', syncError: errMsg } : t))
          );
          setSyncStatus('error');
          setSyncError(errMsg);
          setPendingSyncCount((c) => c + 1);
        }
      }
    },
    [user, currentGroupId, todos, supabase]
  );

  // Operações de Tarefas: Alternar Conclusão
  const toggleTodo = useCallback(
    async (id: string) => {
      const task = todos.find((t) => t.id === id);
      if (!task) return;

      const { completed, status, completedAt } = toggleTaskCompleted(task);
      await updateTodo(id, { completed, status, completedAt });

      if (user && profile) {
        const newCount = syncProfileCompletedCount(profile.completedTasksCount, !task.completed ? 1 : -1);
        updateProfile({ completedTasksCount: newCount }).catch(console.error);
      }
    },
    [todos, updateTodo, user, profile, updateProfile]
  );

  // Operações de Tarefas: Mover Status
  const moveTaskStatus = useCallback(
    async (id: string, newStatus: TaskStatus) => {
      const task = todos.find((t) => t.id === id);
      if (!task) return;

      const { status, completed, completedAt } = transitionTaskStatus(task, newStatus);
      await updateTodo(id, { status, completed, completedAt });
    },
    [todos, updateTodo]
  );

  // Operações de Tarefas: Fixar
  const togglePin = useCallback(
    async (id: string) => {
      const task = todos.find((t) => t.id === id);
      if (!task) return;
      await updateTodo(id, { pinned: !task.pinned });
    },
    [todos, updateTodo]
  );

  // Operações de Tarefas: Excluir (com histórico para Desfazer)
  const deleteTodo = useCallback(
    async (id: string) => {
      const targetContextId = getContextId(user?.id || null, currentGroupId);
      const { remaining, deletedTask } = deleteTodoInContext(todos, id);

      if (deletedTask) {
        setLastDeletedTask({
          task: deletedTask,
          contextId: targetContextId,
        });
      }

      saveContextTodos(user?.id || null, currentGroupId, remaining);
      setTodos(remaining);

      if (user) {
        try {
          const { error } = await supabase.from('tasks').delete().eq('id', id);
          if (error) throw new Error(error.message);
        } catch {
          enqueueSyncItem(user.id, currentGroupId, {
            taskId: id,
            action: 'delete',
            contextId: currentGroupId || user.id,
          });
          setSyncStatus('error');
          setPendingSyncCount((c) => c + 1);
        }
      }
    },
    [user, currentGroupId, todos, supabase]
  );

  // Desfazer Exclusão
  const undoDeleteTodo = useCallback(async () => {
    if (!lastDeletedTask) return;
    const currentContextId = getContextId(user?.id || null, currentGroupId);
    if (lastDeletedTask.contextId !== currentContextId) return;

    const taskToRestore = lastDeletedTask.task;
    const restoredList = restoreTodoInContext(todos, taskToRestore);
    saveContextTodos(user?.id || null, currentGroupId, restoredList);
    setTodos(restoredList);
    setLastDeletedTask(null);

    if (user) {
      await addTodo({
        title: taskToRestore.title,
        description: taskToRestore.description,
        status: taskToRestore.status,
        priority: taskToRestore.priority,
        category: taskToRestore.category,
        dueDate: taskToRestore.dueDate,
        dueTime: taskToRestore.dueTime,
        pinned: taskToRestore.pinned,
        subTasks: taskToRestore.subTasks,
      });
    }
  }, [lastDeletedTask, user, currentGroupId, todos, addTodo]);

  const clearDeletedHistory = useCallback(() => {
    setLastDeletedTask(null);
  }, []);

  // Subtarefas
  const addSubTask = useCallback(
    async (todoId: string, title: string) => {
      const task = todos.find((t) => t.id === todoId);
      if (!task) return;
      const newSub = { id: crypto.randomUUID(), title, completed: false };
      await updateTodo(todoId, { subTasks: [...task.subTasks, newSub] });
    },
    [todos, updateTodo]
  );

  const toggleSubTask = useCallback(
    async (todoId: string, subTaskId: string) => {
      const task = todos.find((t) => t.id === todoId);
      if (!task) return;
      const { updatedTask } = toggleSubTaskInTask(task, subTaskId);

      await updateTodo(todoId, {
        subTasks: updatedTask.subTasks,
        completed: updatedTask.completed,
        status: updatedTask.status,
        completedAt: updatedTask.completedAt,
      });
    },
    [todos, updateTodo]
  );

  const deleteSubTask = useCallback(
    async (todoId: string, subTaskId: string) => {
      const task = todos.find((t) => t.id === todoId);
      if (!task) return;
      const nextSubs = task.subTasks.filter((s) => s.id !== subTaskId);
      await updateTodo(todoId, { subTasks: nextSubs });
    },
    [todos, updateTodo]
  );

  // Operações em Massa: Limpar Concluídas
  const clearCompleted = useCallback(async () => {
    const currentUserId = user?.id || null;
    const targetGroupId = currentGroupId;
    const { remaining, removed } = clearCompletedInContext(todos);
    if (removed.length === 0) return;

    saveContextTodos(currentUserId, targetGroupId, remaining);
    setTodos(remaining);

    if (user) {
      try {
        let query = supabase.from('tasks').delete().eq('completed', true);
        if (targetGroupId) {
          query = query.eq('group_id', targetGroupId);
        } else {
          query = query.eq('user_id', user.id).is('group_id', null);
        }
        await query;
      } catch (err) {
        console.error('Falha ao limpar concluídas na nuvem:', err);
      }
    }
  }, [user, currentGroupId, todos, supabase]);

  // Exemplos (Append ou Replace)
  const resetToDemo = useCallback(
    async (mode: 'append' | 'replace' = 'append') => {
      const currentUserId = user?.id || null;
      const targetGroupId = currentGroupId;
      const currentTodos = todos;

      const nextTodos = prepareDemoTodos(currentTodos, mode, targetGroupId);
      saveContextTodos(currentUserId, targetGroupId, nextTodos);
      setTodos(nextTodos);

      if (user) {
        try {
          if (mode === 'replace') {
            let delQuery = supabase.from('tasks').delete();
            if (targetGroupId) {
              delQuery = delQuery.eq('group_id', targetGroupId);
            } else {
              delQuery = delQuery.eq('user_id', user.id).is('group_id', null);
            }
            await delQuery;
          }
          for (const item of nextTodos) {
            await supabase.from('tasks').upsert({
              id: item.id,
              user_id: user.id,
              group_id: targetGroupId || null,
              title: item.title,
              description: item.description || null,
              status: item.status,
              completed: item.completed,
              priority: item.priority,
              category: item.category,
              due_date: item.dueDate || null,
              due_time: item.dueTime || null,
              pinned: item.pinned,
              order_index: item.order || 0,
            });
          }
          await fetchCloudTodos(user.id, targetGroupId);
        } catch (err) {
          console.error('Falha ao salvar tarefas demo no banco:', err);
        }
      }
    },
    [user, currentGroupId, todos, supabase, fetchCloudTodos]
  );

  // Importar Tarefas (Merge ou Replace)
  const importTodos = useCallback(
    async (importedList: TodoItem[], mode: 'merge' | 'replace') => {
      const currentUserId = user?.id || null;
      const targetGroupId = currentGroupId;
      const currentTodos = todos;

      const nextTodos = prepareImportTodos(currentTodos, importedList, mode, targetGroupId);
      saveContextTodos(currentUserId, targetGroupId, nextTodos);
      setTodos(nextTodos);

      if (user) {
        try {
          if (mode === 'replace') {
            let delQuery = supabase.from('tasks').delete();
            if (targetGroupId) {
              delQuery = delQuery.eq('group_id', targetGroupId);
            } else {
              delQuery = delQuery.eq('user_id', user.id).is('group_id', null);
            }
            await delQuery;
          }
          for (const item of nextTodos) {
            await supabase.from('tasks').upsert({
              id: item.id,
              user_id: user.id,
              group_id: targetGroupId || null,
              title: item.title,
              description: item.description || null,
              status: item.status,
              completed: item.completed,
              priority: item.priority,
              category: item.category,
              due_date: item.dueDate || null,
              due_time: item.dueTime || null,
              pinned: item.pinned,
              order_index: item.order || 0,
            });
          }
          await fetchCloudTodos(user.id, targetGroupId);
        } catch (err) {
          console.error('Falha ao sincronizar tarefas importadas no banco:', err);
        }
      }
    },
    [user, currentGroupId, todos, supabase, fetchCloudTodos]
  );

  const reorderTodos = useCallback((newOrderedTodos: TodoItem[]) => {
    setTodos(newOrderedTodos);
  }, []);

  const incrementPomodoro = useCallback(
    async (id: string) => {
      const task = todos.find((t) => t.id === id);
      if (!task) return;
      await updateTodo(id, { pomodoros: (task.pomodoros || 0) + 1 });
      if (user && profile) {
        updateProfile({ focusMinutes: (profile.focusMinutes || 0) + 25 }).catch(console.error);
      }
    },
    [todos, updateTodo, user, profile, updateProfile]
  );

  // Logout seguro
  const signOut = useCallback(async () => {
    activeRequestIdRef.current++;
    activeContextRef.current = 'guest';
    setProfile(null);
    setGroups([]);
    setCurrentGroupId(null);
    await authSignOut();
    setUser(null);
    const { todos: guestTodos } = loadContextTodos(null, null);
    setTodos(guestTodos);
    setIsLoaded(true);
  }, [authSignOut, setUser, setGroups, setCurrentGroupId]);

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
    todos,
    filteredTodos,
    isLoaded,
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
    profile,
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
