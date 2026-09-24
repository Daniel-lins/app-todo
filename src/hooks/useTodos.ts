'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TodoItem, 
  FilterStatus, 
  Category, 
  Priority, 
  SortOption, 
  TaskStatus, 
  ViewMode,
  UserProfile,
  TaskGroup,
  GroupMember
} from '../types/todo';
import { INITIAL_TODOS, PRIORITIES } from '../utils/todoConstants';
import { createClient } from '../utils/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

const STORAGE_KEY = 'apptodo_tasks_v1';

export function useTodos() {
  const supabase = useMemo(() => createClient(), []);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // User Profile & Collaborative Groups state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

  // Filters & Sorting state
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('createdAt_desc');

  // Helper: map Supabase DB row to TodoItem
  interface SupabaseTaskRow {
    id: string;
    user_id: string;
    title: string;
    description?: string | null;
    completed: boolean;
    status: TaskStatus;
    priority: Priority;
    category: Category;
    due_date?: string | null;
    due_time?: string | null;
    pinned: boolean;
    pomodoros?: number | null;
    order_index?: number | null;
    created_at: string;
    completed_at?: string | null;
    group_id?: string | null;
    created_by_name?: string | null;
    subtasks?: Array<{
      id: string;
      task_id: string;
      title: string;
      completed: boolean;
      created_at: string;
    }>;
  }

  const mapDbToTodo = useCallback((row: SupabaseTaskRow): TodoItem => {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      completed: !!row.completed,
      status: row.status || 'todo',
      priority: row.priority || 'medium',
      category: row.category || 'other',
      dueDate: row.due_date || undefined,
      dueTime: row.due_time || undefined,
      pinned: !!row.pinned,
      pomodoros: row.pomodoros || 0,
      order: row.order_index || 0,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
      groupId: row.group_id || undefined,
      createdByName: row.created_by_name || undefined,
      subTasks: (row.subtasks || []).map((s) => ({
        id: s.id,
        title: s.title,
        completed: !!s.completed,
      })),
    };
  }, []);

  // Profile & Groups fetching
  const fetchUserProfile = useCallback(async (userObj: SupabaseUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userObj.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          id: data.id,
          email: data.email || userObj.email || '',
          displayName: data.display_name || userObj.user_metadata?.display_name || userObj.email?.split('@')[0] || 'Usuário',
          avatarUrl: data.avatar_url || 'rocket',
          focusMinutes: data.focus_minutes || 0,
          completedTasksCount: data.completed_tasks_count || 0,
          updatedAt: data.updated_at,
        });
      } else {
        const initialProfile = {
          id: userObj.id,
          email: userObj.email || '',
          display_name: userObj.user_metadata?.display_name || userObj.email?.split('@')[0] || 'Usuário',
          avatar_url: 'rocket',
          focus_minutes: 0,
          completed_tasks_count: 0,
        };
        await supabase.from('profiles').insert(initialProfile);
        setProfile({
          id: initialProfile.id,
          email: initialProfile.email,
          displayName: initialProfile.display_name,
          avatarUrl: initialProfile.avatar_url,
          focusMinutes: 0,
          completedTasksCount: 0,
        });
      }
    } catch (err) {
      console.error('Failed to load profile', err);
    }
  }, [supabase]);

  const updateProfile = useCallback(async (displayName: string, avatarUrl: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, displayName, avatarUrl } : null));
    } catch (err) {
      console.error('Failed to update profile', err);
      throw err;
    }
  }, [user, supabase]);

  const fetchCloudGroups = useCallback(async (userId: string) => {
    try {
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', userId);

      if (memberErr) throw memberErr;
      if (!memberRows || memberRows.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = memberRows.map((m) => m.group_id);
      const { data: groupsData, error: groupsErr } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds);

      if (groupsErr) throw groupsErr;

      const formatted: TaskGroup[] = (groupsData || []).map((g) => {
        const membership = memberRows.find((m) => m.group_id === g.id);
        return {
          id: g.id,
          name: g.name,
          description: g.description || undefined,
          color: g.color || '#4f46e5',
          inviteCode: g.invite_code,
          createdBy: g.created_by,
          createdAt: g.created_at,
          role: (membership?.role as 'owner' | 'member') || 'member',
        };
      });

      setGroups(formatted);
    } catch (err) {
      console.error('Failed to fetch groups', err);
    }
  }, [supabase]);

  const createGroup = useCallback(async (name: string, description?: string, color?: string): Promise<TaskGroup> => {
    if (!user) throw new Error('É necessário estar conectado para criar grupos.');
    
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const inviteCode = `TODO-${randomChars}`;

    const { data: newGroup, error: groupErr } = await supabase
      .from('groups')
      .insert({
        name,
        description: description || null,
        color: color || '#4f46e5',
        invite_code: inviteCode,
        created_by: user.id,
      })
      .select()
      .single();

    if (groupErr) throw groupErr;

    const { error: memberErr } = await supabase
      .from('group_members')
      .insert({
        group_id: newGroup.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberErr) throw memberErr;

    const createdGroup: TaskGroup = {
      id: newGroup.id,
      name: newGroup.name,
      description: newGroup.description || undefined,
      color: newGroup.color,
      inviteCode: newGroup.invite_code,
      createdBy: newGroup.created_by,
      createdAt: newGroup.created_at,
      role: 'owner',
    };

    setGroups((prev) => [createdGroup, ...prev]);
    setCurrentGroupId(createdGroup.id);
    return createdGroup;
  }, [user, supabase]);

  const joinGroupByCode = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Faça login para entrar em um grupo.' };
    
    const cleanCode = code.trim().toUpperCase();
    
    const { data: foundGroup, error: findErr } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', cleanCode)
      .maybeSingle();

    if (findErr || !foundGroup) {
      return { success: false, message: 'Código de convite inválido ou grupo não encontrado.' };
    }

    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', foundGroup.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      setCurrentGroupId(foundGroup.id);
      return { success: true, message: 'Você já faz parte deste grupo! Grupo ativado.' };
    }

    const { error: joinErr } = await supabase
      .from('group_members')
      .insert({
        group_id: foundGroup.id,
        user_id: user.id,
        role: 'member',
      });

    if (joinErr) {
      return { success: false, message: 'Não foi possível entrar no grupo. Tente novamente.' };
    }

    const joinedGroup: TaskGroup = {
      id: foundGroup.id,
      name: foundGroup.name,
      description: foundGroup.description || undefined,
      color: foundGroup.color,
      inviteCode: foundGroup.invite_code,
      createdBy: foundGroup.created_by,
      createdAt: foundGroup.created_at,
      role: 'member',
    };

    setGroups((prev) => [...prev, joinedGroup]);
    setCurrentGroupId(joinedGroup.id);
    return { success: true, message: `Você entrou no grupo "${foundGroup.name}" com sucesso!` };
  }, [user, supabase]);

  const leaveGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id);

    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (currentGroupId === groupId) {
      setCurrentGroupId(null);
    }
  }, [user, supabase, currentGroupId]);

  const deleteGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)
      .eq('created_by', user.id);

    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (currentGroupId === groupId) {
      setCurrentGroupId(null);
    }
  }, [user, supabase, currentGroupId]);

  const fetchGroupMembers = useCallback(async (groupId: string): Promise<GroupMember[]> => {
    try {
      const { data: members, error } = await supabase
        .from('group_members')
        .select('id, group_id, user_id, role, joined_at')
        .eq('group_id', groupId);

      if (error || !members) return [];

      const userIds = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      return members.map((m) => {
        const p = (profiles || []).find((pr) => pr.id === m.user_id);
        return {
          id: m.id,
          groupId: m.group_id,
          userId: m.user_id,
          role: m.role as 'owner' | 'member',
          joinedAt: m.joined_at,
          profile: p ? {
            id: p.id,
            email: p.email,
            displayName: p.display_name || p.email?.split('@')[0] || 'Membro',
            avatarUrl: p.avatar_url || 'rocket',
          } : undefined,
        };
      });
    } catch (err) {
      console.error('Error fetching group members', err);
      return [];
    }
  }, [supabase]);

  // Fetch tasks from Supabase cloud
  const fetchCloudTodos = useCallback(async (userId: string, targetGroupId: string | null = null) => {
    setIsSyncing(true);
    try {
      let query = supabase
        .from('tasks')
        .select('*, subtasks(*)')
        .order('created_at', { ascending: false });

      if (targetGroupId) {
        query = query.eq('group_id', targetGroupId);
      } else {
        query = query.eq('user_id', userId).is('group_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const cloudList = (data as unknown as SupabaseTaskRow[]).map(mapDbToTodo);
        setTodos(cloudList);
        if (!targetGroupId) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudList));
        }
      } else if (!targetGroupId) {
        // Cloud has no tasks yet for this user in personal space.
        // Check if there are local tasks to migrate to cloud
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const localList: TodoItem[] = JSON.parse(stored);
            if (localList.length > 0 && localList !== INITIAL_TODOS) {
              for (const item of localList) {
                await supabase.from('tasks').insert({
                  id: item.id,
                  user_id: userId,
                  title: item.title,
                  description: item.description || null,
                  completed: item.completed,
                  status: item.status || 'todo',
                  priority: item.priority,
                  category: item.category,
                  due_date: item.dueDate || null,
                  due_time: item.dueTime || null,
                  pinned: item.pinned,
                  pomodoros: item.pomodoros || 0,
                  order_index: item.order || 0,
                  created_at: item.createdAt,
                  completed_at: item.completedAt || null,
                  group_id: null,
                });
                if (item.subTasks && item.subTasks.length > 0) {
                  await supabase.from('subtasks').insert(
                    item.subTasks.map((s) => ({
                      id: s.id,
                      task_id: item.id,
                      title: s.title,
                      completed: s.completed,
                    }))
                  );
                }
              }
            }
          } catch {
            // ignore
          }
        }
        setTodos([]);
      } else {
        setTodos([]);
      }
    } catch (err) {
      console.error('Failed to sync with Supabase', err);
    } finally {
      setIsSyncing(false);
      setIsLoaded(true);
    }
  }, [supabase, mapDbToTodo]);

  // Check Supabase session on mount & subscribe to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserProfile(currentUser);
        fetchCloudGroups(currentUser.id);
        fetchCloudTodos(currentUser.id, currentGroupId);
      } else {
        // Load from localStorage for guest / offline mode
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTodos(parsed);
              setIsLoaded(true);
              return;
            }
          }
          setTodos(INITIAL_TODOS);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TODOS));
        } catch {
          setTodos(INITIAL_TODOS);
        } finally {
          setIsLoaded(true);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          fetchUserProfile(currentUser);
          fetchCloudGroups(currentUser.id);
          fetchCloudTodos(currentUser.id, currentGroupId);
        } else {
          setProfile(null);
          setGroups([]);
          setCurrentGroupId(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchCloudTodos, fetchUserProfile, fetchCloudGroups, currentGroupId]);

  // Switch tasks when currentGroupId changes
  useEffect(() => {
    if (user) {
      fetchCloudTodos(user.id, currentGroupId);
    }
  }, [currentGroupId, user, fetchCloudTodos]);

  // Realtime subscription for Supabase tasks
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-tasks-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        () => {
          fetchCloudTodos(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchCloudTodos]);

  // Save to localStorage as backup/offline cache
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      console.error('Failed to save todos to localStorage', e);
    }
  }, [todos, isLoaded]);

  // Actions with Supabase synchronization
  const addTodo = useCallback(
    async (newTodoData: Omit<TodoItem, 'id' | 'createdAt' | 'completed'>) => {
      const newTodo: TodoItem = {
        ...newTodoData,
        id: 'todo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        createdAt: new Date().toISOString(),
        completed: false,
        groupId: currentGroupId || undefined,
        createdByName: profile?.displayName || user?.email?.split('@')[0] || undefined,
      };

      // Optimistic update
      setTodos((prev) => [newTodo, ...prev]);

      // Sync to cloud if user is logged in
      if (user) {
        try {
          await supabase.from('tasks').insert({
            id: newTodo.id,
            user_id: user.id,
            title: newTodo.title,
            description: newTodo.description || null,
            completed: false,
            status: newTodo.status || 'todo',
            priority: newTodo.priority,
            category: newTodo.category,
            due_date: newTodo.dueDate || null,
            due_time: newTodo.dueTime || null,
            pinned: newTodo.pinned,
            pomodoros: newTodo.pomodoros || 0,
            order_index: newTodo.order || 0,
            created_at: newTodo.createdAt,
            group_id: currentGroupId || null,
            created_by_name: profile?.displayName || user.email?.split('@')[0] || null,
          });

          if (newTodo.subTasks && newTodo.subTasks.length > 0) {
            await supabase.from('subtasks').insert(
              newTodo.subTasks.map((st) => ({
                id: st.id,
                task_id: newTodo.id,
                title: st.title,
                completed: st.completed,
              }))
            );
          }
        } catch (err) {
          console.error('Cloud insert failed:', err);
        }
      }

      return newTodo;
    },
    [user, supabase, currentGroupId, profile]
  );

  const updateTodo = useCallback(
    async (id: string, updates: Partial<TodoItem>) => {
      setTodos((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );

      if (user) {
        try {
          const dbUpdates: Record<string, unknown> = {};
          if (updates.title !== undefined) dbUpdates.title = updates.title;
          if (updates.description !== undefined) dbUpdates.description = updates.description || null;
          if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
          if (updates.status !== undefined) dbUpdates.status = updates.status;
          if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
          if (updates.category !== undefined) dbUpdates.category = updates.category;
          if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null;
          if (updates.dueTime !== undefined) dbUpdates.due_time = updates.dueTime || null;
          if (updates.pinned !== undefined) dbUpdates.pinned = updates.pinned;
          if (updates.pomodoros !== undefined) dbUpdates.pomodoros = updates.pomodoros;
          if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt || null;

          if (Object.keys(dbUpdates).length > 0) {
            await supabase.from('tasks').update(dbUpdates).eq('id', id);
          }

          // If subtasks were updated
          if (updates.subTasks !== undefined) {
            await supabase.from('subtasks').delete().eq('task_id', id);
            if (updates.subTasks.length > 0) {
              await supabase.from('subtasks').insert(
                updates.subTasks.map((st) => ({
                  id: st.id,
                  task_id: id,
                  title: st.title,
                  completed: st.completed,
                }))
              );
            }
          }
        } catch (err) {
          console.error('Cloud update failed:', err);
        }
      }
    },
    [user, supabase]
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      let willComplete = false;
      let completedAtStr: string | undefined = undefined;

      setTodos((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          willComplete = !item.completed;
          completedAtStr = willComplete ? new Date().toISOString() : undefined;
          return {
            ...item,
            completed: willComplete,
            completedAt: completedAtStr,
            subTasks: willComplete
              ? item.subTasks.map((st) => ({ ...st, completed: true }))
              : item.subTasks,
          };
        })
      );

      if (user) {
        try {
          await supabase
            .from('tasks')
            .update({
              completed: willComplete,
              completed_at: completedAtStr || null,
              status: willComplete ? 'completed' : 'todo',
            })
            .eq('id', id);

          if (willComplete) {
            await supabase
              .from('subtasks')
              .update({ completed: true })
              .eq('task_id', id);

            if (profile) {
              const nextCount = (profile.completedTasksCount || 0) + 1;
              setProfile((p) => (p ? { ...p, completedTasksCount: nextCount } : null));
              await supabase
                .from('profiles')
                .update({ completed_tasks_count: nextCount })
                .eq('id', user.id);
            }
          }
        } catch (err) {
          console.error('Cloud toggle failed:', err);
        }
      }
    },
    [user, supabase, profile]
  );

  const togglePin = useCallback(
    async (id: string) => {
      let nextPinned = false;
      setTodos((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            nextPinned = !item.pinned;
            return { ...item, pinned: nextPinned };
          }
          return item;
        })
      );

      if (user) {
        try {
          await supabase.from('tasks').update({ pinned: nextPinned }).eq('id', id);
        } catch (err) {
          console.error('Cloud pin failed:', err);
        }
      }
    },
    [user, supabase]
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      setTodos((prev) => prev.filter((item) => item.id !== id));

      if (user) {
        try {
          await supabase.from('tasks').delete().eq('id', id);
        } catch (err) {
          console.error('Cloud delete failed:', err);
        }
      }
    },
    [user, supabase]
  );

  const toggleSubTask = useCallback(
    async (todoId: string, subTaskId: string) => {
      let nextCompleted = false;

      setTodos((prev) =>
        prev.map((item) => {
          if (item.id !== todoId) return item;
          const updatedSubs = item.subTasks.map((st) => {
            if (st.id === subTaskId) {
              nextCompleted = !st.completed;
              return { ...st, completed: nextCompleted };
            }
            return st;
          });
          const allCompleted =
            updatedSubs.length > 0 && updatedSubs.every((st) => st.completed);
          return {
            ...item,
            subTasks: updatedSubs,
            completed: allCompleted ? true : item.completed,
          };
        })
      );

      if (user) {
        try {
          await supabase
            .from('subtasks')
            .update({ completed: nextCompleted })
            .eq('id', subTaskId);
        } catch (err) {
          console.error('Cloud toggle subtask failed:', err);
        }
      }
    },
    [user, supabase]
  );

  const addSubTask = useCallback(
    async (todoId: string, title: string) => {
      if (!title.trim()) return;
      const newSub = {
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        title: title.trim(),
        completed: false,
      };

      setTodos((prev) =>
        prev.map((item) =>
          item.id === todoId
            ? { ...item, subTasks: [...item.subTasks, newSub] }
            : item
        )
      );

      if (user) {
        try {
          await supabase.from('subtasks').insert({
            id: newSub.id,
            task_id: todoId,
            title: newSub.title,
            completed: false,
          });
        } catch (err) {
          console.error('Cloud add subtask failed:', err);
        }
      }
    },
    [user, supabase]
  );

  const deleteSubTask = useCallback(
    async (todoId: string, subTaskId: string) => {
      setTodos((prev) =>
        prev.map((item) =>
          item.id === todoId
            ? {
                ...item,
                subTasks: item.subTasks.filter((st) => st.id !== subTaskId),
              }
            : item
        )
      );

      if (user) {
        try {
          await supabase.from('subtasks').delete().eq('id', subTaskId);
        } catch (err) {
          console.error('Cloud delete subtask failed:', err);
        }
      }
    },
    [user, supabase]
  );

  const clearCompleted = useCallback(async () => {
    setTodos((prev) => prev.filter((item) => !item.completed));

    if (user) {
      try {
        await supabase
          .from('tasks')
          .delete()
          .eq('user_id', user.id)
          .eq('completed', true);
      } catch (err) {
        console.error('Cloud clear completed failed:', err);
      }
    }
  }, [user, supabase]);

  const resetToDemo = useCallback(async () => {
    setTodos(INITIAL_TODOS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TODOS));

    if (user) {
      try {
        // Clear existing user tasks in cloud
        await supabase.from('tasks').delete().eq('user_id', user.id);

        // Seed demo tasks into cloud
        for (const item of (INITIAL_TODOS as unknown as TodoItem[])) {
          await supabase.from('tasks').insert({
            id: item.id,
            user_id: user.id,
            title: item.title,
            description: item.description || null,
            completed: item.completed,
            status: item.status || 'todo',
            priority: item.priority,
            category: item.category,
            due_date: item.dueDate || null,
            due_time: item.dueTime || null,
            pinned: item.pinned,
            pomodoros: item.pomodoros || 0,
            order_index: item.order || 0,
            created_at: item.createdAt,
            completed_at: item.completedAt || null,
          });
          if (item.subTasks && item.subTasks.length > 0) {
            await supabase.from('subtasks').insert(
              item.subTasks.map((s) => ({
                id: s.id,
                task_id: item.id,
                title: s.title,
                completed: s.completed,
              }))
            );
          }
        }
      } catch (err) {
        console.error('Cloud reset failed:', err);
      }
    }
  }, [user, supabase]);

  // View Mode (List vs Kanban)
  const [viewMode, setViewModeState] = useState<ViewMode>('list');

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('apptodo_view_mode') as ViewMode;
      if (savedMode === 'list' || savedMode === 'kanban') {
        setViewModeState(savedMode);
      }
    } catch {
      // ignore
    }
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem('apptodo_view_mode', mode);
    } catch {
      // ignore
    }
  }, []);

  // Move task status (for Kanban & workflow)
  const moveTaskStatus = useCallback(
    async (id: string, newStatus: TaskStatus) => {
      const willComplete = newStatus === 'completed';
      const completedAtStr = willComplete ? new Date().toISOString() : undefined;

      setTodos((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            status: newStatus,
            completed: willComplete,
            completedAt: willComplete ? (item.completedAt || completedAtStr) : undefined,
            subTasks: willComplete
              ? item.subTasks.map((st) => ({ ...st, completed: true }))
              : item.subTasks,
          };
        })
      );

      if (user) {
        try {
          await supabase
            .from('tasks')
            .update({
              status: newStatus,
              completed: willComplete,
              completed_at: willComplete ? completedAtStr : null,
            })
            .eq('id', id);

          if (willComplete) {
            await supabase
              .from('subtasks')
              .update({ completed: true })
              .eq('task_id', id);
          }
        } catch (err) {
          console.error('Cloud move status failed:', err);
        }
      }
    },
    [user, supabase]
  );

  // Reorder tasks
  const reorderTodos = useCallback((newOrderedTodos: TodoItem[]) => {
    setTodos(newOrderedTodos);
  }, []);

  // Increment Pomodoro session count
  const incrementPomodoro = useCallback(
    async (id: string) => {
      let nextCount = 1;
      setTodos((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            nextCount = (item.pomodoros || 0) + 1;
            return { ...item, pomodoros: nextCount };
          }
          return item;
        })
      );

      if (user) {
        try {
          await supabase.from('tasks').update({ pomodoros: nextCount }).eq('id', id);
          if (profile) {
            const nextFocus = (profile.focusMinutes || 0) + 25;
            setProfile((p) => (p ? { ...p, focusMinutes: nextFocus } : null));
            await supabase
              .from('profiles')
              .update({ focus_minutes: nextFocus })
              .eq('id', user.id);
          }
        } catch (err) {
          console.error('Cloud increment pomodoro failed:', err);
        }
      }
    },
    [user, supabase, profile]
  );

  // Import / Export tools
  const importTodos = useCallback(
    async (importedList: TodoItem[], mode: 'replace' | 'merge') => {
      const sanitized = importedList.map((item, idx) => ({
        id: item.id || `todo-${Date.now()}-${idx}`,
        title: item.title || 'Sem título',
        description: item.description || '',
        completed: !!item.completed,
        status: item.status || (item.completed ? 'completed' : 'todo'),
        priority: item.priority || 'medium',
        category: item.category || 'other',
        dueDate: item.dueDate || undefined,
        dueTime: item.dueTime || undefined,
        subTasks: Array.isArray(item.subTasks) ? item.subTasks : [],
        pinned: !!item.pinned,
        createdAt: item.createdAt || new Date().toISOString(),
        completedAt: item.completedAt || undefined,
        pomodoros: typeof item.pomodoros === 'number' ? item.pomodoros : 0,
        order: typeof item.order === 'number' ? item.order : idx,
      })) as TodoItem[];

      let finalTodos: TodoItem[] = [];

      if (mode === 'replace') {
        finalTodos = sanitized;
      } else {
        const map = new Map<string, TodoItem>();
        todos.forEach((t) => map.set(t.id, t));
        sanitized.forEach((t) => map.set(t.id, t));
        finalTodos = Array.from(map.values());
      }

      setTodos(finalTodos);

      if (user) {
        try {
          if (mode === 'replace') {
            await supabase.from('tasks').delete().eq('user_id', user.id);
          }
          for (const item of sanitized) {
            await supabase.from('tasks').upsert({
              id: item.id,
              user_id: user.id,
              title: item.title,
              description: item.description || null,
              completed: item.completed,
              status: item.status || 'todo',
              priority: item.priority,
              category: item.category,
              due_date: item.dueDate || null,
              due_time: item.dueTime || null,
              pinned: item.pinned,
              pomodoros: item.pomodoros || 0,
              order_index: item.order || 0,
              created_at: item.createdAt,
              completed_at: item.completedAt || null,
            });
            if (item.subTasks && item.subTasks.length > 0) {
              for (const st of item.subTasks) {
                await supabase.from('subtasks').upsert({
                  id: st.id,
                  task_id: item.id,
                  title: st.title,
                  completed: st.completed,
                });
              }
            }
          }
        } catch (err) {
          console.error('Cloud import failed:', err);
        }
      }
    },
    [todos, user, supabase]
  );

  // Filtered and Sorted list
  const filteredTodos = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return todos
      .filter((item) => {
        if (filterStatus === 'active' && item.completed) return false;
        if (filterStatus === 'completed' && !item.completed) return false;
        if (filterStatus === 'pinned' && !item.pinned) return false;
        if (filterStatus === 'today') {
          if (!item.dueDate || item.dueDate !== todayStr) return false;
        }

        if (filterCategory !== 'all' && item.category !== filterCategory) {
          return false;
        }

        if (filterPriority !== 'all' && item.priority !== filterPriority) {
          return false;
        }

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchesTitle = item.title.toLowerCase().includes(query);
          const matchesDesc = item.description?.toLowerCase().includes(query);
          const matchesSubTasks = item.subTasks.some((st) =>
            st.title.toLowerCase().includes(query)
          );
          if (!matchesTitle && !matchesDesc && !matchesSubTasks) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned && a.completed === b.completed) {
          return a.pinned ? -1 : 1;
        }

        switch (sortBy) {
          case 'createdAt_desc':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'createdAt_asc':
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case 'dueDate_asc':
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
          case 'dueDate_desc':
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return b.dueDate.localeCompare(a.dueDate);
          case 'priority_desc':
            return PRIORITIES[b.priority].weight - PRIORITIES[a.priority].weight;
          case 'alphabetical':
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
  }, [todos, filterStatus, filterCategory, filterPriority, searchQuery, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const active = total - completed;
    const pinned = todos.filter((t) => t.pinned && !t.completed).length;
    const urgent = todos.filter((t) => t.priority === 'urgent' && !t.completed).length;

    const todayStr = new Date().toISOString().split('T')[0];
    const overdue = todos.filter(
      (t) => !t.completed && t.dueDate && t.dueDate < todayStr
    ).length;
    const todayCount = todos.filter(
      (t) => t.dueDate === todayStr && !t.completed
    ).length;

    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      active,
      pinned,
      urgent,
      overdue,
      todayCount,
      rate,
    };
  }, [todos]);

  return {
    todos,
    filteredTodos,
    isLoaded,
    user,
    isSyncing,
    refetchCloud: () => user && fetchCloudTodos(user.id),
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
  };
}
