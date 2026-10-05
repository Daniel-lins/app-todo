'use client';

import React from 'react';
import { Calendar, ListTodo, Users, Flag, Trophy } from 'lucide-react';

export type MobileTab = 'today' | 'all' | 'groups' | 'missions' | 'achievements';

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  onOpenGroups: () => void;
  onOpenRpg?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenGroups,
}) => {
  return (
    <nav
      aria-label="Navegação inferior mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800 px-4 py-1.5 safe-area-pb"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Hoje */}
        <button
          type="button"
          onClick={() => onSelectTab('today')}
          aria-current={activeTab === 'today' ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 min-h-11 py-1 px-1 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'today'
              ? 'text-[#5b4fe9] font-semibold'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span>Hoje</span>
        </button>

        {/* Tarefas */}
        <button
          type="button"
          onClick={() => onSelectTab('all')}
          aria-current={activeTab === 'all' ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 min-h-11 py-1 px-1 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'all'
              ? 'text-[#5b4fe9] font-semibold'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <ListTodo className="w-5 h-5" />
          <span>Tarefas</span>
        </button>

        {([{ id: 'missions', label: 'Missões', Icon: Flag }, { id: 'achievements', label: 'Conquistas', Icon: Trophy }] as const).map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => onSelectTab(id)} aria-current={activeTab === id ? 'page' : undefined} className={`min-h-11 flex flex-col items-center gap-0.5 py-1 px-1 rounded-lg text-[11px] font-medium ${activeTab === id ? 'text-[#5b4fe9] dark:text-[#a59bfb]' : 'text-zinc-500 dark:text-zinc-400'}`}><Icon className="w-5 h-5" /><span>{label}</span></button>)}

        {/* Grupos */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('groups');
            onOpenGroups();
          }}
          aria-current={activeTab === 'groups' ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 min-h-11 py-1 px-1 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'groups'
              ? 'text-[#5b4fe9] font-semibold'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>Grupos</span>
        </button>
      </div>
    </nav>
  );
};
