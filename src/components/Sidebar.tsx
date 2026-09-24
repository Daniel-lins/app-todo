'use client';

import React from 'react';
import { 
  CheckSquare2, 
  Calendar, 
  ListTodo, 
  Pin, 
  CheckCircle2, 
  Plus, 
  Settings, 
  ChevronRight,
  User as UserIcon,
} from 'lucide-react';
import { FilterStatus, TaskGroup, UserProfile } from '../types/todo';
import { AVATAR_PRESETS } from '../utils/todoConstants';

interface SidebarProps {
  filterStatus: FilterStatus;
  onSelectFilter: (status: FilterStatus) => void;
  groups: TaskGroup[];
  currentGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onOpenCreateGroup: () => void;
  todayCount: number;
  profile: UserProfile | null;
  isLoggedIn: boolean;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  filterStatus,
  onSelectFilter,
  groups,
  currentGroupId,
  onSelectGroup,
  onOpenCreateGroup,
  todayCount,
  profile,
  isLoggedIn,
  onOpenProfile,
  onOpenAuth,
  onOpenSettings,
}) => {
  const avatarPreset = AVATAR_PRESETS.find((a) => a.id === profile?.avatarUrl) || AVATAR_PRESETS[0];

  const isNavActive = (status: FilterStatus) => {
    return currentGroupId === null && filterStatus === status;
  };

  const handleNavClick = (status: FilterStatus) => {
    onSelectGroup(null); // Volta para o espaço pessoal
    onSelectFilter(status);
  };

  return (
    <aside 
      aria-label="Navegação principal"
      className="hidden md:flex flex-col w-56 lg:w-60 h-screen sticky top-0 shrink-0 bg-[#f5f5f7] dark:bg-[#14151b] border-r border-[#e8e8ec] dark:border-[#242530] p-4 select-none z-20"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-2 py-2">
        <div className="w-8 h-8 rounded-xl bg-[#ede9fe] dark:bg-[#2b275c] text-[#5b4fe9] dark:text-[#a59bfb] flex items-center justify-center shadow-xs">
          <CheckSquare2 className="w-5 h-5 stroke-[2.2]" />
        </div>
        <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100">
          AppToDo
        </span>
      </div>

      {/* Main Navigation (Meu espaço) */}
      <div className="mt-5 flex-1 overflow-y-auto pr-1">
        <div className="px-2.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
          Meu espaço
        </div>

        <nav className="space-y-0.5" aria-label="Espaço pessoal">
          {/* Hoje */}
          <button
            type="button"
            onClick={() => handleNavClick('today')}
            aria-current={isNavActive('today') ? 'page' : undefined}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              isNavActive('today')
                ? 'bg-[#ede9fe] dark:bg-[#252249] text-[#5b4fe9] dark:text-[#a59bfb] font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Calendar className="w-4 h-4 shrink-0 stroke-[1.8]" />
              <span className="truncate">Hoje</span>
            </div>
            {todayCount > 0 && (
              <span 
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  isNavActive('today')
                    ? 'bg-[#5b4fe9]/15 dark:bg-[#a59bfb]/20 text-[#5b4fe9] dark:text-[#a59bfb]'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {todayCount}
              </span>
            )}
          </button>

          {/* Todas as tarefas */}
          <button
            type="button"
            onClick={() => handleNavClick('all')}
            aria-current={isNavActive('all') ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              isNavActive('all')
                ? 'bg-[#ede9fe] dark:bg-[#252249] text-[#5b4fe9] dark:text-[#a59bfb] font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <ListTodo className="w-4 h-4 shrink-0 stroke-[1.8]" />
            <span className="truncate">Todas as tarefas</span>
          </button>

          {/* Fixadas */}
          <button
            type="button"
            onClick={() => handleNavClick('pinned')}
            aria-current={isNavActive('pinned') ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              isNavActive('pinned')
                ? 'bg-[#ede9fe] dark:bg-[#252249] text-[#5b4fe9] dark:text-[#a59bfb] font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Pin className="w-4 h-4 shrink-0 stroke-[1.8]" />
            <span className="truncate">Fixadas</span>
          </button>

          {/* Concluídas */}
          <button
            type="button"
            onClick={() => handleNavClick('completed')}
            aria-current={isNavActive('completed') ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              isNavActive('completed')
                ? 'bg-[#ede9fe] dark:bg-[#252249] text-[#5b4fe9] dark:text-[#a59bfb] font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[1.8]" />
            <span className="truncate">Concluídas</span>
          </button>
        </nav>

        {/* Groups Section */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-2.5 mb-1.5">
            <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Grupos
            </span>
            <button
              type="button"
              onClick={onOpenCreateGroup}
              title="Gerenciar ou criar grupos"
              aria-label="Gerenciar ou criar grupos"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5" role="list" aria-label="Grupos colaborativos">
            {groups.length === 0 ? (
              <button
                type="button"
                onClick={onOpenCreateGroup}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-400 dark:text-zinc-500 hover:text-[#5b4fe9] dark:hover:text-[#a59bfb] transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full border border-dashed border-zinc-400 shrink-0" />
                <span className="truncate italic">Criar primeiro grupo</span>
              </button>
            ) : (
              groups.map((group) => {
                const isGroupActive = currentGroupId === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onSelectGroup(group.id)}
                    aria-current={isGroupActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isGroupActive
                        ? 'bg-[#ede9fe] dark:bg-[#252249] text-[#5b4fe9] dark:text-[#a59bfb] font-semibold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" 
                      style={{ backgroundColor: group.color || '#5b4fe9' }}
                    />
                    <span className="truncate">{group.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="pt-3 border-t border-[#e8e8ec] dark:border-[#242530] space-y-1">
        {/* Settings button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <Settings className="w-4 h-4 shrink-0 stroke-[1.8]" />
          <span>Configurações</span>
        </button>

        {/* User Account / Profile button */}
        {isLoggedIn && profile ? (
          <button
            type="button"
            onClick={onOpenProfile}
            title="Abrir perfil da conta"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base leading-none shrink-0" aria-hidden="true">
                {avatarPreset.emoji}
              </span>
              <span className="truncate font-semibold">{profile.displayName || 'Minha Conta'}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[#5b4fe9] dark:text-[#a59bfb] hover:bg-[#ede9fe]/60 dark:hover:bg-[#252249]/60 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <UserIcon className="w-4 h-4" />
              <span>Entrar / Cadastrar</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
};
