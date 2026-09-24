'use client';

import React from 'react';
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  ArrowUpDown, 
  RotateCcw, 
  CheckCheck,
  Plus,
  LayoutList,
  Kanban,
  FileJson,
  Keyboard
} from 'lucide-react';
import { FilterStatus, Category, Priority, SortOption, ViewMode } from '../types/todo';
import { CATEGORIES, PRIORITIES } from '../utils/todoConstants';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  status: FilterStatus;
  onStatusChange: (s: FilterStatus) => void;
  category: Category | 'all';
  onCategoryChange: (c: Category | 'all') => void;
  priority: Priority | 'all';
  onPriorityChange: (p: Priority | 'all') => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  onClearCompleted: () => void;
  onResetDemo: () => void;
  onOpenNewTaskModal: () => void;
  completedCount: number;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  onOpenBackupModal: () => void;
  onOpenShortcutsModal: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
  priority,
  onPriorityChange,
  sortBy,
  onSortChange,
  onClearCompleted,
  onResetDemo,
  onOpenNewTaskModal,
  completedCount,
  viewMode,
  onViewModeChange,
  onOpenBackupModal,
  onOpenShortcutsModal,
}) => {
  const statusTabs: { id: FilterStatus; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'active', label: 'Pendentes' },
    { id: 'completed', label: 'Concluídas' },
    { id: 'pinned', label: 'Fixadas' },
    { id: 'today', label: 'Hoje' },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Top search & Primary action row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Pesquisar tarefas, notas ou subtarefas..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-sm transition-all"
          />
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Controls container */}
        <div className="flex items-center gap-2">
          {/* View Mode Switcher (List vs Kanban) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/60 dark:border-zinc-700/60">
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              title="Visualização em Lista (Tecla K)"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              title="Visualização em Quadro Kanban (Tecla K)"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
          </div>

          {/* Primary CTA button: Nova Tarefa */}
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs and Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-1">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/50 overflow-x-auto max-w-full">
          {statusTabs.map((tab) => {
            const isActive = status === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusChange(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dropdowns & Utilities */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value as Category | 'all')}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Todas Categorias</option>
              {(Object.keys(CATEGORIES) as Category[]).map((catKey) => (
                <option key={catKey} value={catKey}>
                  {CATEGORIES[catKey].label}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2 pointer-events-none" />
          </div>

          {/* Priority Dropdown */}
          <div className="relative">
            <select
              value={priority}
              onChange={(e) => onPriorityChange(e.target.value as Priority | 'all')}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Todas Prioridades</option>
              {(Object.keys(PRIORITIES) as Priority[]).map((pKey) => (
                <option key={pKey} value={pKey}>
                  {PRIORITIES[pKey].label}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2 pointer-events-none" />
          </div>

          {/* Sort By Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="createdAt_desc">Mais Recentes</option>
              <option value="createdAt_asc">Mais Antigas</option>
              <option value="dueDate_asc">Vencimento Próximo</option>
              <option value="dueDate_desc">Vencimento Distante</option>
              <option value="priority_desc">Maior Prioridade</option>
              <option value="alphabetical">Ordem Alfabética (A-Z)</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2 pointer-events-none" />
          </div>

          {/* Clear completed button */}
          {completedCount > 0 && (
            <button
              type="button"
              onClick={onClearCompleted}
              title="Remover todas as tarefas concluídas"
              className="p-1.5 text-xs font-medium text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar Concluídas</span>
            </button>
          )}

          {/* Reset to demo */}
          <button
            type="button"
            onClick={onResetDemo}
            title="Restaurar tarefas de exemplo"
            className="p-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exemplos</span>
          </button>

          {/* Backup Modal trigger */}
          <button
            type="button"
            onClick={onOpenBackupModal}
            title="Backup (Exportar / Importar JSON)"
            className="p-1.5 text-xs font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backup</span>
          </button>

          {/* Shortcuts Modal trigger */}
          <button
            type="button"
            onClick={onOpenShortcutsModal}
            title="Atalhos de Teclado (Tecla ?)"
            className="p-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Atalhos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
