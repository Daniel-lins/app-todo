'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { 
  CheckSquare2, 
  ListTodo, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  X, 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  Kanban as KanbanIcon, 
  RotateCcw,
  Settings
} from 'lucide-react';
import { useTodos } from '../hooks/useTodos';
import { usePomodoro } from '../hooks/usePomodoro';
import { TodoItem, Category, Priority, SortOption } from '../types/todo';
import { Sidebar } from '../components/Sidebar';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import { KanbanBoard } from '../components/KanbanBoard';
import { PomodoroModal } from '../components/PomodoroModal';
import { PomodoroWidget } from '../components/PomodoroWidget';
import { MobileNav, MobileTab } from '../components/MobileNav';
import { SettingsModal } from '../components/SettingsModal';
import { AuthModal } from '../components/AuthModal';
import type { ConfirmModalProps } from '../components/ConfirmModal';
import { AVATAR_PRESETS, CATEGORIES, PRIORITIES } from '../utils/todoConstants';
import { getLocalDateString } from '../utils/dateUtils';
import { 
  checkDeadlinesAndNotify,
  getNotificationStatus,
  NotificationStatus
} from '../utils/notificationService';

// Modais secundários carregados sob demanda
const NotificationModal = dynamic(
  () => import('../components/NotificationModal').then((m) => m.NotificationModal),
  { ssr: false }
);
const BackupModal = dynamic(
  () => import('../components/BackupModal').then((m) => m.BackupModal),
  { ssr: false }
);
const ShortcutsModal = dynamic(
  () => import('../components/ShortcutsModal').then((m) => m.ShortcutsModal),
  { ssr: false }
);
const ProfileModal = dynamic(
  () => import('../components/ProfileModal').then((m) => m.ProfileModal),
  { ssr: false }
);
const GroupsModal = dynamic(
  () => import('../components/GroupsModal').then((m) => m.GroupsModal),
  { ssr: false }
);
const ConfirmModal = dynamic(
  () => import('../components/ConfirmModal').then((m) => m.ConfirmModal),
  { ssr: false }
);

export default function Home() {
  const {
    todos,
    filteredTodos,
    isLoaded,
    contextId,
    todayDateStr,
    syncError,
    user,
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
    moveTaskStatus,
    incrementPomodoro,
    importTodos,
    getPreviousBackup,
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
    syncStatus,
    pendingSyncCount,
    retrySync,
  } = useTodos();

  // Estados dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TodoItem | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isCompletedSectionOpen, setIsCompletedSectionOpen] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>(() =>
    typeof window !== 'undefined' ? getNotificationStatus() : 'default'
  );

  // Tab mobile ativa
  const [mobileTab, setMobileTab] = useState<MobileTab>('today');

  // Pomodoro timer desacoplado
  const pomodoro = usePomodoro({
    todos,
    isLoaded,
    contextId,
    onSessionComplete: incrementPomodoro,
  });

  // Modal de confirmação para ações destrutivas
  const [confirmConfig, setConfirmConfig] = useState<Omit<ConfirmModalProps, 'onClose'> | null>(null);

  // Toast de desfazer exclusão
  const [undoToast, setUndoToast] = useState<{ title: string } | null>(null);

  useEffect(() => {
    if (!undoToast) return;
    const timer = setTimeout(() => {
      setUndoToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  // Verificação periódica de prazos
  useEffect(() => {
    checkDeadlinesAndNotify(todos);
    const interval = setInterval(() => {
      checkDeadlinesAndNotify(todos);
    }, 60000);
    return () => clearInterval(interval);
  }, [todos]);

  // Formatação de data em português: "Quinta-feira, 24 de setembro"
  const formattedToday = useMemo(() => {
    try {
      const now = new Date(`${todayDateStr}T12:00:00`);
      const str = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(now);
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return 'Hoje';
    }
  }, [todayDateStr]);

  const handleOpenCreate = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleOpenCreateWithPrefill = (prefillTitle?: string) => {
    if (prefillTitle && prefillTitle.trim()) {
      setEditingTask({
        id: '',
        title: prefillTitle.trim(),
        completed: false,
        pinned: false,
        status: 'todo',
        priority: 'medium',
        category: 'other',
        subTasks: [],
        createdAt: '',
      });
    } else {
      setEditingTask(null);
    }
    setIsModalOpen(true);
  };

  const handleQuickCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    try {
      await addTodo({
        title: quickTitle.trim(),
        pinned: false,
        status: 'todo',
        priority: 'medium',
        category: 'other',
        subTasks: [],
        groupId: currentGroupId || undefined,
        dueDate: filterStatus === 'today' ? getLocalDateString() : undefined,
      });
      setQuickTitle('');
    } catch (err) {
      console.error('Falha ao adicionar tarefa rápida:', err);
    }
  };

  const handleOpenEdit = (task: TodoItem) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleStartPomodoro = (task: TodoItem) => {
    pomodoro.bindTask(task);
    pomodoro.openModal();
  };

  const handleModalSubmit = async (data: Omit<TodoItem, 'id' | 'createdAt' | 'completed'>) => {
    if (editingTask && editingTask.id) {
      await updateTodo(editingTask.id, data);
    } else {
      await addTodo(data);
      setQuickTitle('');
    }
  };

  const { isModalOpen: isPomodoroModalOpen, closeModal: closePomodoroModal } = pomodoro;

  // Atalhos de teclado com proteção
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      const isAnyModalOpen =
        isModalOpen ||
        isPomodoroModalOpen ||
        isBackupOpen ||
        isShortcutsOpen ||
        isAuthOpen ||
        isNotificationModalOpen ||
        isProfileOpen ||
        isGroupsOpen ||
        isSettingsOpen;

      if (e.key === 'Escape') {
        if (isAnyModalOpen) {
          e.preventDefault();
          setIsModalOpen(false);
          closePomodoroModal();
          setIsBackupOpen(false);
          setIsShortcutsOpen(false);
          setIsAuthOpen(false);
          setIsNotificationModalOpen(false);
          setIsProfileOpen(false);
          setIsGroupsOpen(false);
          setIsSettingsOpen(false);
        }
        return;
      }

      if (isInput || isAnyModalOpen) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleOpenCreate();
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-search-input]')).find(input => input.offsetParent !== null);
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setViewMode(viewMode === 'list' ? 'kanban' : 'list');
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewMode,
    setViewMode,
    isModalOpen,
    isPomodoroModalOpen,
    closePomodoroModal,
    isBackupOpen,
    isShortcutsOpen,
    isAuthOpen,
    isNotificationModalOpen,
    isProfileOpen,
    isGroupsOpen,
    isSettingsOpen,
  ]);

  const activeGroup = groups.find((g) => g.id === currentGroupId) || null;
  const currentSpaceName = activeGroup
    ? `Grupo: ${activeGroup.name}`
    : user
    ? 'Espaço Pessoal'
    : 'Modo Visitante';
  const avatarPreset = AVATAR_PRESETS.find((a) => a.id === profile?.avatarUrl) || AVATAR_PRESETS[0];

  // Identificação do título da visualização atual
  const viewTitle = useMemo(() => {
    if (activeGroup) return activeGroup.name;
    switch (filterStatus) {
      case 'today':
        return 'Hoje';
      case 'all':
        return 'Todas as tarefas';
      case 'pinned':
        return 'Fixadas';
      case 'completed':
        return 'Concluídas';
      default:
        return 'Minhas tarefas';
    }
  }, [activeGroup, filterStatus]);

  // Separação entre tarefas ativas (próximas) e tarefas concluídas para a lista
  const activeTasks = useMemo(() => {
    return filteredTodos.filter((t) => !t.completed);
  }, [filteredTodos]);

  const completedTasks = useMemo(() => {
    return filteredTodos.filter((t) => t.completed);
  }, [filteredTodos]);

  const handleDeleteTask = async (id: string) => {
    const taskToDelete = todos.find((t) => t.id === id);
    await deleteTodo(id);
    if (taskToDelete) {
      setUndoToast({ title: taskToDelete.title });
    }
  };

  const handleUndo = async () => {
    await undoDeleteTodo();
    setUndoToast(null);
  };

  const handleMobileTabSelect = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === 'today') {
      setCurrentGroupId(null);
      setFilterStatus('today');
    } else if (tab === 'all') {
      setCurrentGroupId(null);
      setFilterStatus('all');
    }
  };

  const todayTasksCount = useMemo(() => {
    return todos.filter((t) => !t.completed && t.dueDate === todayDateStr).length;
  }, [todos, todayDateStr]);

  // Contagem para o espaço e período exibidos
  const displayedTotal = filteredTodos.length;
  const displayedCompleted = filteredTodos.filter(task => task.completed).length;
  const progressPercent = displayedTotal ? Math.round(displayedCompleted / displayedTotal * 100) : 0;

  return (
    <div className="min-h-screen bg-[#fbfbfb] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-[#ede9fe] selection:text-[#5b4fe9]">
      {/* 1. Sidebar à esquerda no Desktop */}
      <Sidebar
        filterStatus={filterStatus}
        onSelectFilter={(status) => {
          setFilterStatus(status);
        }}
        groups={groups}
        currentGroupId={currentGroupId}
        onSelectGroup={(groupId) => {
          setCurrentGroupId(groupId);
          setFilterStatus('all');
        }}
        onOpenCreateGroup={() => setIsGroupsOpen(true)}
        todayCount={todayTasksCount}
        profile={profile}
        isLoggedIn={!!user}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Área Principal à direita */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-24">
        {/* Cabeçalho superior compacto (Desktop) */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 bg-[#fbfbfb]/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
          {/* Breadcrumb: < Meu espaço / Hoje */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-400 dark:text-zinc-500 font-normal">&lsaquo;</span>
            <button 
              type="button" 
              onClick={() => {
                setCurrentGroupId(null);
                setFilterStatus('all');
              }}
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              {activeGroup ? activeGroup.name : 'Meu espaço'}
            </button>
            <span className="text-zinc-300 dark:text-zinc-600">/</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {viewTitle}
            </span>
          </div>

          {/* Lado direito do cabeçalho: Busca + Sincronização + Avatar */}
          <div className="flex items-center gap-4">
            {/* Campo de Busca funcional */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 pointer-events-none" />
              <input
                data-search-input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar"
                aria-label="Buscar tarefas"
                className="w-44 lg:w-56 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#5b4fe9] focus:border-[#5b4fe9] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpar busca"
                  className="absolute right-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Estado Real de Sincronização */}
            <div className="flex items-center gap-1.5 text-xs">
              {!user ? (
                <span 
                  className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400"
                  title="Modo local. Conectar à sua conta na nuvem para sincronizar entre aparelhos."
                >
                  <span className="w-2 h-2 rounded-full bg-zinc-400" />
                  <span>Salvo localmente</span>
                </span>
              ) : syncStatus === 'syncing' ? (
                <span className="inline-flex items-center gap-1.5 text-[#5b4fe9]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Sincronizando...</span>
                </span>
              ) : syncStatus === 'synced' && pendingSyncCount === 0 ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Sincronizado</span>
                </span>
              ) : syncStatus !== 'error' && (syncStatus === 'local_only' || pendingSyncCount > 0) ? (
                <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Salvo localmente ({pendingSyncCount})</span>
                </span>
              ) : syncStatus === 'error' ? (
                <button
                  type="button"
                  onClick={() => retrySync()}
                  title="Não foi possível salvar alterações na nuvem. Clique para tentar novamente."
                  className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>Erro ao sincronizar</span>
                </button>
              ) : null}
            </div>

            {/* Avatar / Acesso à conta */}
            <button
              type="button"
              onClick={() => {
                if (user) {
                  setIsProfileOpen(true);
                } else {
                  setIsAuthOpen(true);
                }
              }}
              title={user ? `Perfil de ${profile?.displayName || user.email}` : 'Conectar à sua conta na nuvem'}
              aria-label={user ? 'Acessar perfil' : 'Entrar na conta'}
              className="w-8 h-8 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-sm shadow-xs hover:ring-2 hover:ring-[#5b4fe9] transition-all focus:outline-none focus:ring-2 focus:ring-[#5b4fe9]"
            >
              {avatarPreset.emoji}
            </button>
          </div>
        </header>

        {/* Topo Mobile (Adaptado para celular conforme mockup) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#ede9fe] dark:bg-[#2b275c] text-[#5b4fe9] dark:text-[#a59bfb] flex items-center justify-center">
              <CheckSquare2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100">
              AppToDo
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sincronização compacta */}
            {syncStatus === 'synced' && pendingSyncCount === 0 && user ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Sincronizado" />
            ) : syncStatus === 'error' ? (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Não foi possível salvar alterações na nuvem." />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Salvo localmente" />
            )}

            <button type="button" aria-label="Abrir configurações" onClick={() => setIsSettingsOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Settings className="w-5 h-5" />
            </button>
            {/* Avatar mobile */}
            <button
              type="button"
              onClick={() => {
                if (user) {
                  setIsProfileOpen(true);
                } else {
                  setIsAuthOpen(true);
                }
              }}
              aria-label={user ? 'Abrir perfil' : 'Entrar'}
              className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm"
            >
              {avatarPreset.emoji}
            </button>
          </div>
        </header>

        {/* Conteúdo Central */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 flex flex-col">
          {(syncError || pomodoro.timerError) && (
            <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              <p>{syncError || pomodoro.timerError}</p>
              {pendingSyncCount > 0 && <p className="mt-1">{pendingSyncCount} alterações salvas neste dispositivo aguardam envio.</p>}
              {user && <button type="button" onClick={() => void retrySync()} className="mt-2 min-h-11 font-semibold underline">Tentar sincronizar novamente</button>}
            </div>
          )}
          <div className="md:hidden relative mb-5">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
            <input type="search" data-search-input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              aria-label="Buscar tarefas no celular" placeholder="Buscar tarefas"
              className="w-full min-h-11 rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#5b4fe9]" />
          </div>
          {!isLoaded && <p role="status" className="mb-4 text-sm text-zinc-500">Carregando suas tarefas…</p>}
          {/* Título Principal + Data + Botão "+ Nova tarefa" */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                {viewTitle}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 font-normal">
                {filterStatus === 'today' ? formattedToday : `${displayedTotal} tarefas`}
              </p>
            </div>

            {/* Botão Principal "+ Nova tarefa" */}
            <button
              type="button"
              onClick={handleOpenCreate}
              disabled={!isLoaded}
              className="bg-[#5b4fe9] hover:bg-[#4d40d9] text-white text-xs sm:text-sm font-semibold px-4 py-2 sm:py-2.5 rounded-xl shadow-xs transition-all duration-150 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#5b4fe9] focus:ring-offset-2 active:scale-98 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nova tarefa</span>
            </button>
          </div>

          {/* Barra de Progresso Compacta: "2 de 5 concluídas" + Barra fina */}
          <div className="mb-5 sm:mb-6">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {displayedCompleted} de {displayedTotal} concluídas
              </span>
              <div className="w-36 sm:w-48 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#5b4fe9] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Ferramentas: Alternância [ Lista | Kanban ] + Botão Filtros */}
          <div className="flex items-center justify-between gap-3 mb-4">
            {/* Segmented Control Lista / Kanban */}
            <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-800 text-[#5b4fe9] dark:text-[#a59bfb] shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                aria-pressed={viewMode === 'kanban'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-white dark:bg-zinc-800 text-[#5b4fe9] dark:text-[#a59bfb] shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <KanbanIcon className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>
            </div>

            {/* Botão Filtros */}
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              aria-expanded={isFilterPanelOpen}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                isFilterPanelOpen || filterCategory !== 'all' || filterPriority !== 'all'
                  ? 'border-[#5b4fe9] bg-[#ede9fe]/50 dark:bg-[#5b4fe9]/10 text-[#5b4fe9] dark:text-[#a59bfb]'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
            </button>
          </div>

          {/* Painel expansível de Filtros */}
          {isFilterPanelOpen && (
            <div className="mb-4 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs animate-in fade-in duration-150 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Categoria */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium">Categoria:</span>
                  <select
                    aria-label="Filtrar por categoria"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
                    className="text-xs py-1 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#5b4fe9]"
                  >
                    <option value="all">Todas as categorias</option>
                    {Object.values(CATEGORIES).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Prioridade */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium">Prioridade:</span>
                  <select
                    aria-label="Filtrar por prioridade"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
                    className="text-xs py-1 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#5b4fe9]"
                  >
                    <option value="all">Todas as prioridades</option>
                    {Object.values(PRIORITIES).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ordenação */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium">Ordenar:</span>
                  <select
                    aria-label="Ordenar tarefas"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="text-xs py-1 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#5b4fe9]"
                  >
                    <option value="createdAt_desc">Mais recentes</option>
                    <option value="dueDate_asc">Prazo mais próximo</option>
                    <option value="priority_desc">Prioridade alta</option>
                    <option value="alphabetical">Alfabética</option>
                  </select>
                </div>

                {/* Limpar Filtros */}
                {(filterCategory !== 'all' || filterPriority !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory('all');
                      setFilterPriority('all');
                    }}
                    className="text-xs text-[#5b4fe9] hover:underline font-medium ml-auto"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 5. Linha de Criação Rápida "+ Adicionar uma tarefa..." */}
          <form
            onSubmit={handleQuickCaptureSubmit}
            className="mb-5 relative flex items-center rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 focus-within:border-[#5b4fe9] focus-within:ring-1 focus-within:ring-[#5b4fe9] transition-all"
          >
            <div className="pl-3.5 pr-2 text-zinc-400">
              <Plus className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Adicionar uma tarefa..."
              aria-label="Adicionar uma tarefa rapidamente"
              disabled={!isLoaded}
              className="flex-1 min-w-0 py-3 text-xs sm:text-sm bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
            />
            {quickTitle.trim() && (
              <div className="pr-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenCreateWithPrefill(quickTitle)}
                  title="Expandir para formulário completo com detalhes"
                  className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Detalhes
                </button>
                <button
                  type="submit"
                  className="text-xs font-semibold text-white bg-[#5b4fe9] hover:bg-[#4d40d9] px-3 py-1 rounded-lg transition-colors shadow-xs"
                >
                  Criar
                </button>
              </div>
            )}
          </form>

          {/* Conteúdo de Tarefas: Visualização Lista ou Kanban */}
          {viewMode === 'kanban' ? (
            <KanbanBoard
              todos={filteredTodos}
              onMoveTask={moveTaskStatus}
              onEditTask={handleOpenEdit}
              onDeleteTask={handleDeleteTask}
              onTogglePin={togglePin}
              onStartPomodoro={handleStartPomodoro}
            />
          ) : (
            <div className="flex-1 space-y-6">
              {/* Seção 1: PRÓXIMAS TAREFAS */}
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 px-1">
                  Próximas Tarefas
                </h2>

                {activeTasks.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white/40 dark:bg-zinc-900/40">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Nenhuma tarefa pendente nesta visualização.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-zinc-900/60 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 overflow-visible divide-y divide-zinc-100 dark:divide-zinc-800/80 shadow-xs">
                    {activeTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={toggleTodo}
                        onDelete={handleDeleteTask}
                        onPin={togglePin}
                        onEdit={handleOpenEdit}
                        onToggleSubTask={toggleSubTask}
                        onAddSubTask={addSubTask}
                        onDeleteSubTask={deleteSubTask}
                        onStartPomodoro={handleStartPomodoro}
                        onMoveTask={moveTaskStatus}
                        isPomodoroActiveTask={pomodoro.isTimerActive && pomodoro.taskId === task.id}
                        groupName={groups.find((g) => g.id === task.groupId)?.name}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Seção 2: CONCLUÍDAS • {count} (Recolhível) */}
              {completedTasks.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsCompletedSectionOpen(!isCompletedSectionOpen)}
                    aria-expanded={isCompletedSectionOpen}
                    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-2 px-1 transition-colors"
                  >
                    {isCompletedSectionOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <span>Concluídas • {completedTasks.length}</span>
                  </button>

                  {isCompletedSectionOpen && (
                    <div className="bg-white dark:bg-zinc-900/60 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 overflow-visible divide-y divide-zinc-100 dark:divide-zinc-800/80 shadow-xs">
                      {completedTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={toggleTodo}
                          onDelete={handleDeleteTask}
                          onPin={togglePin}
                          onEdit={handleOpenEdit}
                          onToggleSubTask={toggleSubTask}
                          onAddSubTask={addSubTask}
                          onDeleteSubTask={deleteSubTask}
                          onStartPomodoro={handleStartPomodoro}
                          onMoveTask={moveTaskStatus}
                          isPomodoroActiveTask={pomodoro.isTimerActive && pomodoro.taskId === task.id}
                          groupName={groups.find((g) => g.id === task.groupId)?.name}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* 3. Barra Docked do Pomodoro (quando houver sessão ativa) */}
      <PomodoroWidget
        isVisible={pomodoro.isTimerActive}
        isRunning={pomodoro.isRunning}
        mode={pomodoro.mode}
        formattedTime={pomodoro.formattedTime}
        progressPercent={pomodoro.progressPercent}
        taskTitle={pomodoro.taskTitle}
        onToggleRun={pomodoro.toggleRun}
        onOpenModal={pomodoro.openModal}
        onReset={pomodoro.reset}
      />

      {/* 4. Navegação Inferior Mobile */}
      <MobileNav
        activeTab={mobileTab}
        onSelectTab={handleMobileTabSelect}
        onOpenGroups={() => setIsGroupsOpen(true)}
      />

      {/* Toast de Desfazer Exclusão */}
      {undoToast && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-4 py-2.5 rounded-xl shadow-xl border border-zinc-700 dark:border-zinc-200 text-xs font-medium animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <span>Tarefa excluída: &quot;{undoToast.title}&quot;</span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-[#a59bfb] dark:text-[#5b4fe9] font-bold hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Desfazer
          </button>
        </div>
      )}

      {/* Modais do Aplicativo */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleModalSubmit}
        initialData={editingTask}
      />

      <PomodoroModal
        isOpen={pomodoro.isModalOpen}
        onClose={pomodoro.closeModal}
        session={pomodoro.session}
        timeLeft={pomodoro.timeLeft}
        isRunning={pomodoro.isRunning}
        mode={pomodoro.mode}
        taskTitle={pomodoro.taskTitle}
        progressPercent={pomodoro.progressPercent}
        formattedTime={pomodoro.formattedTime}
        soundEnabled={pomodoro.soundEnabled}
        onToggleRun={pomodoro.toggleRun}
        onReset={pomodoro.reset}
        onSetMode={pomodoro.setMode}
        onToggleSound={pomodoro.toggleSound}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        todos={todos}
        spaceName={currentSpaceName}
        onImport={importTodos}
        getPreviousBackup={getPreviousBackup}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onAuthSuccess={() => setIsAuthOpen(false)}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        groups={groups}
        onUpdateProfile={async (displayName, avatarUrl) => {
          await updateProfile({ displayName, avatarUrl });
        }}
        onSignOut={signOut}
      />

      <GroupsModal
        isOpen={isGroupsOpen}
        onClose={() => setIsGroupsOpen(false)}
        groups={groups}
        currentGroupId={currentGroupId}
        onSelectGroup={setCurrentGroupId}
        onCreateGroup={createGroup}
        onJoinGroup={joinGroupByCode}
        onLeaveGroup={leaveGroup}
        onDeleteGroup={deleteGroup}
        onFetchMembers={fetchGroupMembers}
        isLoggedIn={!!user}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        status={notificationStatus}
        onStatusChange={setNotificationStatus}
      />

      {confirmConfig && confirmConfig.isOpen && (
        <ConfirmModal
          {...confirmConfig}
          onClose={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
}
