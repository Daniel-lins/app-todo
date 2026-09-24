'use client';

import React from 'react';
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  ArrowUpDown, 
  RotateCcw, 
  CheckCheck,
  LayoutList,
  Kanban,
  FileJson,
  Keyboard,
  Pin,
  Calendar
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
  onOpenNewTaskModal?: () => void;
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
  completedCount,
  viewMode,
  onViewModeChange,
  onOpenBackupModal,
  onOpenShortcutsModal,
}) => {
  const statusTabs: { id: FilterStatus; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'active', label: 'Pendentes' },
    { id: 'completed', label: 'Concluídas' },
    { id: 'pinned', label: 'Fixadas', icon: <Pin className="w-3 h-3 fill-current" /> },
    { id: 'today', label: 'Hoje', icon: <Calendar className="w-3 h-3" /> },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Row 1: Search Bar & View Mode Switcher */}
      <div className="flex items-center gap-2.5">
        {/* Search Bar */}
        <div className="relative flex-1">
          <label htmlFor="main-search-input" className="sr-only">
            Pesquisar tarefas, notas ou subtarefas
          </label>
          <input
            id="main-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Pesquisar tarefas... (Tecla /)"
            aria-label="Pesquisar tarefas, notas ou subtarefas"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-sm transition-all min-h-[40px]"
          />
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpar campo de pesquisa"
              className="absolute right-2 top-1.5 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 min-h-[32px] min-w-[32px] flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Mode Switcher (List vs Kanban) */}
        <div 
          role="radiogroup" 
          aria-label="Modo de visualização"
          className="flex items-center gap-1 p-0.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0"
        >
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'list'}
            aria-label="Visualização em Lista (Tecla K)"
            onClick={() => onViewModeChange('list')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
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
            role="radio"
            aria-checked={viewMode === 'kanban'}
            aria-label="Visualização em Quadro Kanban (Tecla K)"
            onClick={() => onViewModeChange('kanban')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
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
      </div>

      {/* Row 2: Status Pills (never hidden or scrolled off screen) + Secondary filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        {/* Status Pills with flex-wrap - Todas, Pendentes, Concluídas, Fixadas, Hoje are always visible */}
        <div 
          role="tablist" 
          aria-label="Filtrar por status"
          className="flex items-center flex-wrap gap-1 p-1 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/70 border border-zinc-200/50 dark:border-zinc-700/50 w-full sm:w-auto"
        >
          {statusTabs.map((tab) => {
            const isActive = status === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Filtro: ${tab.label}`}
                onClick={() => onStatusChange(tab.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all min-h-[32px] ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dropdowns & Utilities */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {/* Category Dropdown */}
          <div className="relative">
            <label htmlFor="filter-category-select" className="sr-only">
              Filtrar por categoria
            </label>
            <select
              id="filter-category-select"
              value={category}
              onChange={(e) => onCategoryChange(e.target.value as Category | 'all')}
              aria-label="Filtrar por categoria"
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[36px]"
            >
              <option value="all">Todas Categorias</option>
              {(Object.keys(CATEGORIES) as Category[]).map((catKey) => (
                <option key={catKey} value={catKey}>
                  {CATEGORIES[catKey].label}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Priority Dropdown */}
          <div className="relative">
            <label htmlFor="filter-priority-select" className="sr-only">
              Filtrar por prioridade
            </label>
            <select
              id="filter-priority-select"
              value={priority}
              onChange={(e) => onPriorityChange(e.target.value as Priority | 'all')}
              aria-label="Filtrar por prioridade"
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[36px]"
            >
              <option value="all">Todas Prioridades</option>
              {(Object.keys(PRIORITIES) as Priority[]).map((pKey) => (
                <option key={pKey} value={pKey}>
                  {PRIORITIES[pKey].label}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Sort By Dropdown */}
          <div className="relative">
            <label htmlFor="filter-sort-select" className="sr-only">
              Ordenar tarefas
            </label>
            <select
              id="filter-sort-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              aria-label="Ordenar tarefas"
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[36px]"
            >
              <option value="createdAt_desc">Mais Recentes</option>
              <option value="createdAt_asc">Mais Antigas</option>
              <option value="dueDate_asc">Vencimento Próximo</option>
              <option value="dueDate_desc">Vencimento Distante</option>
              <option value="priority_desc">Maior Prioridade</option>
              <option value="alphabetical">Ordem Alfabética (A-Z)</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Clear completed button */}
          {completedCount > 0 && (
            <button
              type="button"
              onClick={onClearCompleted}
              title={`Limpar ${completedCount} tarefas concluídas`}
              aria-label={`Limpar ${completedCount} tarefas concluídas deste espaço`}
              className="p-1.5 text-xs font-medium text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 min-h-[36px]"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar Concluídas ({completedCount})</span>
            </button>
          )}

          {/* Reset to demo */}
          <button
            type="button"
            onClick={onResetDemo}
            title="Restaurar tarefas de exemplo"
            aria-label="Restaurar tarefas de exemplo"
            className="p-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 min-h-[36px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exemplos</span>
          </button>

          {/* Backup Modal trigger */}
          <button
            type="button"
            onClick={onOpenBackupModal}
            title="Backup (Exportar / Importar JSON)"
            aria-label="Abrir central de backup"
            className="p-1.5 text-xs font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 min-h-[36px]"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backup</span>
          </button>

          {/* Shortcuts Modal trigger */}
          <button
            type="button"
            onClick={onOpenShortcutsModal}
            title="Atalhos de Teclado (Tecla ?)"
            aria-label="Abrir atalhos de teclado"
            className="p-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 min-h-[36px]"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Atalhos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
