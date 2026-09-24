'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Flame, 
  AlertCircle, 
  Calendar, 
  Sparkles, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { TaskStats } from '../types/todo';

interface StatsBarProps {
  stats: TaskStats;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section
      aria-label="Visão geral e estatísticas do espaço"
      className="w-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-3 sm:p-4 shadow-sm shadow-zinc-200/40 dark:shadow-none transition-all duration-300"
    >
      {/* Compact Primary Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left info summary */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Produtividade
            </h2>
            {stats.rate === 100 && stats.total > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3 h-3" /> 100%
              </span>
            )}
          </div>
          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {stats.total === 0
              ? 'Nenhuma tarefa cadastrada'
              : `${stats.completed}/${stats.total} concluídas (${stats.rate}%) • Hoje: ${stats.todayCompleted}/${stats.todayTotal}`}
          </p>
        </div>

        {/* Right mini progress bar & details toggle */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
          {/* Progress bar */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <div
              role="progressbar"
              aria-valuenow={stats.rate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso geral de conclusão do espaço"
              className="h-2 w-28 sm:w-36 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5"
            >
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${stats.rate}%` }}
              />
            </div>
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
              {stats.rate}%
            </span>
          </div>

          {/* Toggle Details Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls="stats-details-grid"
            aria-label={isExpanded ? 'Ocultar métricas detalhadas' : 'Ver métricas detalhadas'}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors min-h-[32px]"
          >
            <span>{isExpanded ? 'Menos' : 'Métricas'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* On-demand Detailed Metric Counters */}
      {isExpanded && (
        <div
          id="stats-details-grid"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 mt-3 border-t border-zinc-100 dark:border-zinc-800 animate-in fade-in duration-200"
        >
          {/* Total Pendentes */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                {stats.active}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Pendentes (Geral)</div>
            </div>
          </div>

          {/* Total Concluídas */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                {stats.completed}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Concluídas (Geral)</div>
            </div>
          </div>

          {/* Produtividade de Hoje */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                {stats.todayCompleted}/{stats.todayTotal}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Hoje ({stats.todayPending} a fazer)
              </div>
            </div>
          </div>

          {/* Atrasadas ou Urgentes */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              {stats.overdue > 0 ? <AlertCircle className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                {stats.overdue > 0 ? stats.overdue : stats.urgent}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {stats.overdue > 0 ? 'Atrasadas' : 'Urgentes'}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

