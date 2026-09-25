'use client';

import { useState, useMemo, useEffect, useCallback, useSyncExternalStore } from 'react';
import { 
  TodoItem, 
  FilterStatus, 
  Category, 
  Priority, 
  SortOption, 
  ViewMode, 
  TaskStats 
} from '../types/todo';
import { 
  getLocalDateString, 
  getMsUntilNextMidnight 
} from '../utils/dateUtils';
import { calculateTaskStats } from '../utils/taskDomain';

const subscribeHydration = () => () => {};

export function useTaskFilters(todos: TodoItem[]) {
  const isClient = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('today');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('createdAt_desc');

  // Inicializa o modo de visualização com lazy initializer sem setState em efeito
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'list';
    try {
      const savedMode = localStorage.getItem('apptodo_view_mode') as ViewMode;
      if (savedMode === 'list' || savedMode === 'kanban') {
        return savedMode;
      }
    } catch {
      // Ignora erro de acesso a localStorage
    }
    return 'list';
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem('apptodo_view_mode', mode);
    } catch {
      // Ignora
    }
  }, []);

  // Rastreia a data local e recomputa tarefas do dia automaticamente na virada da meia-noite
  const [todayDateStr, setTodayDateStr] = useState(() => getLocalDateString());

  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const scheduleNextMidnightCheck = () => {
      const ms = getMsUntilNextMidnight();
      timerId = setTimeout(() => {
        setTodayDateStr(getLocalDateString());
        scheduleNextMidnightCheck();
      }, ms);
    };

    scheduleNextMidnightCheck();
    const refreshDate = () => setTodayDateStr(getLocalDateString());
    window.addEventListener('focus', refreshDate);
    return () => { clearTimeout(timerId); window.removeEventListener('focus', refreshDate); };
  }, []);

  // Centralização das regras de filtragem e ordenação compartilhadas entre Lista e Kanban
  const filteredTodos = useMemo(() => {
    return todos
      .filter((task) => {
        // Status filter
        if (filterStatus === 'active' && task.completed) return false;
        if (filterStatus === 'completed' && !task.completed) return false;
        if (filterStatus === 'pinned' && !task.pinned) return false;
        if (filterStatus === 'today') {
          if (task.dueDate !== todayDateStr) return false;
        }

        // Category filter
        if (filterCategory !== 'all' && task.category !== filterCategory) return false;

        // Priority filter
        if (filterPriority !== 'all' && task.priority !== filterPriority) return false;

        // Search filter (título, descrição e subtarefas)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesTitle = task.title.toLowerCase().includes(q);
          const matchesDesc = task.description?.toLowerCase().includes(q);
          const matchesSub = task.subTasks.some((st) => st.title.toLowerCase().includes(q));
          if (!matchesTitle && !matchesDesc && !matchesSub) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'createdAt_asc':
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case 'createdAt_desc':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'dueDate_asc':
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
          case 'dueDate_desc':
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return b.dueDate.localeCompare(a.dueDate);
          case 'priority_desc': {
            const prioMap = { urgent: 4, high: 3, medium: 2, low: 1 };
            return prioMap[b.priority] - prioMap[a.priority];
          }
          case 'alphabetical':
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
  }, [todos, filterStatus, filterCategory, filterPriority, searchQuery, sortBy, todayDateStr]);

  // Estatísticas calculadas de forma determinística
  const stats: TaskStats = useMemo(() => {
    return calculateTaskStats(todos, new Date(`${todayDateStr}T12:00:00`));
  }, [todos, todayDateStr]);

  return {
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
    viewMode: isClient ? viewMode : 'list' as ViewMode,
    setViewMode,
    filteredTodos,
    stats,
    todayDateStr,
  };
}
