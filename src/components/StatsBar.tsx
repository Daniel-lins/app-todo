'use client';

import React from 'react';
import { CheckCircle2, Clock, Flame, AlertCircle, Calendar, Sparkles } from 'lucide-react';

interface StatsBarProps {
  stats: {
    total: number;
    completed: number;
    active: number;
    pinned: number;
    urgent: number;
    overdue: number;
    todayCount: number;
    rate: number;
  };
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  return (
    <div className="w-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm shadow-zinc-200/40 dark:shadow-none transition-all duration-300">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <span>Produtividade de Hoje</span>
            {stats.rate === 100 && stats.total > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" /> 100% Concluído
              </span>
            )}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {stats.total === 0
              ? 'Nenhuma tarefa cadastrada. Adicione sua primeira tarefa abaixo!'
              : `${stats.completed} de ${stats.total} tarefas finalizadas (${stats.rate}%)`}
          </p>
        </div>

        {/* Progress percent badge */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:w-48">
            <div className="flex justify-between items-center text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              <span>Progresso Geral</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{stats.rate}%</span>
            </div>
            <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${stats.rate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mini metric counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
              {stats.active}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Pendentes</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
              {stats.completed}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Concluídas</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
              {stats.todayCount}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Para Hoje</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            {stats.overdue > 0 ? <AlertCircle className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
              {stats.overdue > 0 ? stats.overdue : stats.urgent}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {stats.overdue > 0 ? 'Atrasadas' : 'Urgentes'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
