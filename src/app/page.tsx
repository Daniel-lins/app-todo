'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckSquare2, 
  ListTodo, 
  Plus, 
  Sparkles, 
  Layers, 
  Pin, 
  Inbox, 
  FilterX,
  Bell,
  BellRing,
  Cloud,
  Loader2
} from 'lucide-react';
import { useTodos } from '../hooks/useTodos';
import { TodoItem } from '../types/todo';
import { StatsBar } from '../components/StatsBar';
import { FilterBar } from '../components/FilterBar';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { KanbanBoard } from '../components/KanbanBoard';
import { PomodoroModal } from '../components/PomodoroModal';
import { BackupModal } from '../components/BackupModal';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { AuthModal } from '../components/AuthModal';

export default function Home() {
  const {
    todos,
    filteredTodos,
    isLoaded,
    user,
    isSyncing,
    refetchCloud,
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
    incrementPomodoro,
    importTodos,
  } = useTodos();

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TodoItem | null>(null);

  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [activePomodoroTask, setActivePomodoroTask] = useState<TodoItem | null>(null);

  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador não suporta notificações web.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        const todayStr = new Date().toISOString().split('T')[0];
        const pendingToday = todos.filter((t) => !t.completed && t.dueDate === todayStr).length;
        new Notification('AppToDo - Notificações Ativadas! 🔔', {
          body: pendingToday > 0 
            ? `Você tem ${pendingToday} tarefa(s) agendada(s) para hoje!` 
            : 'Tudo pronto! Você receberá avisos sobre seus prazos e foco.',
          icon: '/favicon.ico',
        });
      }
    } catch {
      // ignore
    }
  };

  const handleOpenCreate = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task: TodoItem) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleStartPomodoro = (task: TodoItem) => {
    setActivePomodoroTask(task);
    setIsPomodoroOpen(true);
  };

  const handleModalSubmit = (data: Omit<TodoItem, 'id' | 'createdAt' | 'completed'>) => {
    if (editingTask) {
      updateTodo(editingTask.id, data);
    } else {
      addTodo(data);
    }
  };

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;

      // Escape closes any open modal
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setIsPomodoroOpen(false);
        setIsBackupOpen(false);
        setIsShortcutsOpen(false);
        setIsAuthOpen(false);
        return;
      }

      // Ignore other shortcuts when typing in inputs
      if (isInput) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleOpenCreate();
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
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
  }, [viewMode, setViewMode]);

  // Split tasks into pinned and unpinned if in 'all' view
  const pinnedTasks = filteredTodos.filter((t) => t.pinned && !t.completed);
  const regularTasks = filteredTodos.filter((t) => !t.pinned || t.completed);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100 dark:from-[#090d16] dark:via-[#0c111d] dark:to-[#090d16] text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Subtle background ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/5 blur-3xl rounded-full" />
        <div className="absolute top-1/2 -right-40 w-[450px] h-[450px] bg-blue-500/5 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col gap-8">
        {/* Header Bar */}
        <header className="flex items-center justify-between gap-4 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <CheckSquare2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-700 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent">
                  AppToDo
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="w-3 h-3" /> v1.1
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Organize seu dia, acompanhe metas e alcance resultados
              </p>
            </div>
          </div>

          {/* Right utility buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Notification alert toggle */}
            <button
              type="button"
              onClick={handleRequestNotifications}
              title={
                notificationPermission === 'granted'
                  ? 'Notificações ativadas'
                  : 'Ativar notificações de prazos'
              }
              className={`p-2.5 rounded-xl border transition-colors ${
                notificationPermission === 'granted'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {notificationPermission === 'granted' ? (
                <BellRing className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>

            {/* Cloud Sync / Account Button */}
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              title={user ? `Conectado como ${user.email} (Supabase Cloud)` : 'Conectar à Nuvem Supabase'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-xs font-semibold ${
                user
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-indigo-500/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
              }`}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              ) : (
                <Cloud className={`w-4 h-4 ${user ? 'text-emerald-500' : 'text-indigo-500'}`} />
              )}
              <span className="hidden sm:inline">
                {user ? (user.email?.split('@')[0] || 'Nuvem') : 'Nuvem'}
              </span>
            </button>

            <ThemeToggle />

            <button
              type="button"
              onClick={handleOpenCreate}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Criar Tarefa</span>
            </button>
          </div>
        </header>

        {/* Productivity Analytics Overview */}
        <StatsBar stats={stats} />

        {/* Filters, Search, View Mode and Controls */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          status={filterStatus}
          onStatusChange={setFilterStatus}
          category={filterCategory}
          onCategoryChange={setFilterCategory}
          priority={filterPriority}
          onPriorityChange={setFilterPriority}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onClearCompleted={clearCompleted}
          onResetDemo={resetToDemo}
          onOpenNewTaskModal={handleOpenCreate}
          completedCount={stats.completed}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenBackupModal={() => setIsBackupOpen(true)}
          onOpenShortcutsModal={() => setIsShortcutsOpen(true)}
        />

        {/* Main Workspace Section */}
        <main className="flex-1 flex flex-col gap-6">
          {!isLoaded ? (
            /* Loading state */
            <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Carregando suas tarefas...</p>
            </div>
          ) : viewMode === 'kanban' ? (
            /* Kanban View */
            <KanbanBoard
              todos={filteredTodos}
              onMoveTask={moveTaskStatus}
              onEditTask={handleOpenEdit}
              onDeleteTask={deleteTodo}
              onTogglePin={togglePin}
              onStartPomodoro={handleStartPomodoro}
            />
          ) : filteredTodos.length === 0 ? (
            /* Empty State */
            <div className="py-16 px-4 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
                {searchQuery || filterCategory !== 'all' || filterPriority !== 'all' || filterStatus !== 'all' ? (
                  <FilterX className="w-7 h-7 text-zinc-400" />
                ) : (
                  <Inbox className="w-7 h-7 text-zinc-400" />
                )}
              </div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                Nenhuma tarefa encontrada
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mt-1 mb-5">
                {searchQuery || filterCategory !== 'all' || filterPriority !== 'all' || filterStatus !== 'all'
                  ? 'Nenhuma tarefa corresponde aos filtros aplicados. Tente ajustar sua busca ou limpar os filtros.'
                  : 'Sua lista está limpa! Aproveite para cadastrar uma nova meta ou tarefa do seu dia.'}
              </p>
              {searchQuery || filterCategory !== 'all' || filterPriority !== 'all' || filterStatus !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCategory('all');
                    setFilterPriority('all');
                    setFilterStatus('all');
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors"
                >
                  Limpar todos os filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                >
                  Criar Primeira Tarefa
                </button>
              )}
            </div>
          ) : (
            /* Standard List View */
            <div className="space-y-6">
              {/* Pinned Tasks Group */}
              {pinnedTasks.length > 0 && filterStatus !== 'pinned' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-1">
                    <Pin className="w-3.5 h-3.5 fill-current" />
                    <span>Tarefas Fixadas ({pinnedTasks.length})</span>
                  </div>
                  <div className="space-y-3">
                    {pinnedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={toggleTodo}
                        onDelete={deleteTodo}
                        onPin={togglePin}
                        onEdit={handleOpenEdit}
                        onToggleSubTask={toggleSubTask}
                        onAddSubTask={addSubTask}
                        onDeleteSubTask={deleteSubTask}
                        onStartPomodoro={handleStartPomodoro}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Regular or Filtered Tasks Group */}
              <div className="space-y-3">
                {pinnedTasks.length > 0 && filterStatus !== 'pinned' && regularTasks.length > 0 && (
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 px-1 pt-2">
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>Outras Tarefas ({regularTasks.length})</span>
                  </div>
                )}
                <div className="space-y-3">
                  {(pinnedTasks.length > 0 && filterStatus !== 'pinned' ? regularTasks : filteredTodos).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={toggleTodo}
                      onDelete={deleteTodo}
                      onPin={togglePin}
                      onEdit={handleOpenEdit}
                      onToggleSubTask={toggleSubTask}
                      onAddSubTask={addSubTask}
                      onDeleteSubTask={deleteSubTask}
                      onStartPomodoro={handleStartPomodoro}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="pt-8 pb-4 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>AppToDo • Gestão Inteligente com Kanban & Pomodoro</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              className="hover:underline flex items-center gap-1 cursor-pointer"
            >
              Atalhos (Pressione ?)
            </button>
            <span>•</span>
            <span>Armazenamento local seguro</span>
          </div>
        </footer>
      </div>

      {/* Floating Action Button (Mobile) */}
      <div className="fixed bottom-6 right-6 sm:hidden z-40">
        <button
          type="button"
          onClick={handleOpenCreate}
          aria-label="Adicionar Tarefa"
          className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      {/* Task Modal (Create & Edit) */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialData={editingTask}
      />

      {/* Pomodoro Timer Modal */}
      <PomodoroModal
        isOpen={isPomodoroOpen}
        onClose={() => setIsPomodoroOpen(false)}
        task={activePomodoroTask}
        onSessionComplete={incrementPomodoro}
      />

      {/* Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        todos={todos}
        onImport={importTodos}
      />

      {/* Shortcuts Guide Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Supabase Cloud Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onAuthSuccess={refetchCloud}
      />
    </div>
  );
}
