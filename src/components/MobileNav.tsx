"use client";

import React from "react";
import {
  Calendar,
  CalendarDays,
  ListTodo,
  Users,
  Flag,
  Trophy,
} from "lucide-react";

export type MobileTab =
  | "today"
  | "all"
  | "week"
  | "groups"
  | "missions"
  | "achievements";

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  onOpenGroups: () => void;
  onOpenRpg?: () => void;
}

const tabs = [
  { id: "today", label: "Hoje", Icon: Calendar },
  { id: "all", label: "Tarefas", Icon: ListTodo },
  { id: "week", label: "Semana", Icon: CalendarDays },
  { id: "missions", label: "Missões", Icon: Flag },
  { id: "achievements", label: "Conquistas", Icon: Trophy },
  { id: "groups", label: "Grupos", Icon: Users },
] as const;

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenGroups,
}) => (
  <nav
    aria-label="Navegação inferior mobile"
    className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800 px-1 py-1.5 safe-area-pb"
  >
    <div className="grid grid-cols-6 max-w-md mx-auto">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={activeTab === id ? "page" : undefined}
          onClick={() => {
            onSelectTab(id);
            if (id === "groups") onOpenGroups();
          }}
          className={`flex min-h-12 min-w-11 flex-col items-center justify-center gap-1 rounded-lg text-[10px] min-[360px]:text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2 ${activeTab === id ? "text-[#5b4fe9] dark:text-[#a59bfb] font-semibold bg-indigo-50 dark:bg-indigo-950/50" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  </nav>
);
