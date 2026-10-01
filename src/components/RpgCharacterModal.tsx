'use client';

import React, { useState, useRef } from 'react';
import { X, Zap, Award, Briefcase, BookOpen, Heart, DollarSign, Sparkles, Shield, CheckCircle2, Clock } from 'lucide-react';
import type { RpgStats, UserProfile, Category } from '../types/todo';
import { useAccessibleModal } from '../hooks/useAccessibleModal';

interface Props {
  isOpen: boolean; onClose: () => void; rpgStats: RpgStats;
  profile: UserProfile | null; scopeName: string; isGroup: boolean; historyError: string | null;
}
const icons = { work: Briefcase, study: BookOpen, health: Heart, finance: DollarSign, personal: Sparkles, other: Shield };

function Progress({ value, label }: { value: number; label: string }) {
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}
    className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
    <div className="h-full bg-[#5b4fe9] transition-[width] duration-300" style={{ width: `${value}%` }} />
  </div>;
}

export function RpgCharacterModal({ isOpen, onClose, rpgStats: stats, scopeName, isGroup, historyError }: Props) {
  const [tab, setTab] = useState<'areas' | 'badges'>('areas');
  const closeRef = useRef<HTMLButtonElement>(null);
  const { modalRef } = useAccessibleModal({ isOpen, onClose, initialFocusRef: closeRef });
  if (!isOpen) return null;
  const unlocked = stats.badges.filter(b => b.unlocked).length;

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60">
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="rpg-title"
      className="w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xl">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="min-w-0">
          <h2 id="rpg-title" className="text-lg font-semibold">{isGroup ? 'Evolução do grupo' : 'Sua evolução'}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{scopeName}</p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar evolução"
          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-[#5b4fe9]">
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="overflow-y-auto p-5 sm:p-6 space-y-6">
        {historyError && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">{historyError}</p>}
        <section aria-label="Resumo da evolução" className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold">Nível {stats.level}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{stats.title}</p>
            </div>
            <span className="text-sm font-semibold text-[#5b4fe9] dark:text-[#a59bfb] tabular-nums whitespace-nowrap">{stats.totalXp} XP</span>
          </div>
          <Progress value={stats.progressPercent} label={`Progresso para o nível ${stats.level + 1}`} />
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">
            <span>{stats.nextLevelXp - stats.currentLevelXp} XP para o nível {stats.level + 1}</span>
            <span>{stats.progressPercent}%</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{stats.tasksCompletedCount} concluídas</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{stats.pomodoroFocusMinutes} min de foco</span>
            <span className="flex items-center gap-1.5"><Award className="w-4 h-4" />{unlocked}/{stats.badges.length} conquistas</span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {isGroup ? 'Progresso coletivo das tarefas deste grupo. ' : 'Progresso das tarefas deste espaço. '}
            Excluir tarefas preserva as recompensas. Reabrir uma tarefa retira sua recompensa de conclusão.
          </p>
        </section>

        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800" role="tablist" aria-label="Detalhes da evolução">
          {(['areas', 'badges'] as const).map(value => <button key={value} id={`rpg-tab-${value}`} type="button" role="tab"
            aria-selected={tab === value} aria-controls={`rpg-panel-${value}`} tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)} onKeyDown={e => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                const next = e.key === 'Home' ? 'areas' : e.key === 'End' ? 'badges' : tab === 'areas' ? 'badges' : 'areas';
                setTab(next); document.getElementById(`rpg-tab-${next}`)?.focus();
              }
            }} className={`min-h-11 px-4 border-b-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[#5b4fe9] ${tab === value ? 'border-[#5b4fe9] text-[#5b4fe9] dark:text-[#a59bfb]' : 'border-transparent text-zinc-600 dark:text-zinc-400'}`}>
            {value === 'areas' ? 'Áreas' : 'Conquistas'}
          </button>)}
        </div>

        <div id={`rpg-panel-${tab}`} role="tabpanel" aria-labelledby={`rpg-tab-${tab}`}>
          {tab === 'areas' ? <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
            {Object.values(stats.attributes).map(attr => {
              const Icon = icons[attr.id as Category];
              return <section key={attr.id} className="space-y-2">
                <div className="flex justify-between items-center gap-3 text-sm">
                  <h3 className="flex items-center gap-2 font-medium"><Icon className="w-4 h-4" />{attr.areaName}</h3>
                  <span className="text-zinc-600 dark:text-zinc-400 tabular-nums">Nv. {attr.level}</span>
                </div>
                <Progress value={attr.progressPercent} label={`Progresso em ${attr.areaName}`} />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">{attr.currentLevelXp}/{attr.nextLevelXp} XP · {attr.progressPercent}%</p>
              </section>;
            })}
          </div> : <ul className="space-y-4">
            {stats.badges.map(badge => <li key={badge.id} className="flex gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4 last:border-0">
              <Award className={`w-5 h-5 mt-0.5 shrink-0 ${badge.unlocked ? 'text-[#5b4fe9] dark:text-[#a59bfb]' : 'text-zinc-500'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-1 text-sm"><h3 className="font-medium">{badge.title}</h3><span className="text-zinc-600 dark:text-zinc-400">{badge.unlocked ? 'Conquistada' : 'A conquistar'}</span></div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{badge.description}</p>
                {!badge.unlocked && badge.progress && <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 tabular-nums">{badge.progress.current}/{badge.progress.total}</p>}
              </div>
            </li>)}
          </ul>}
        </div>
        <details className="text-sm text-zinc-600 dark:text-zinc-400">
          <summary className="cursor-pointer min-h-11 flex items-center gap-2"><Zap className="w-4 h-4" />Como ganhar XP</summary>
          <p className="leading-relaxed">Cada tarefa concluída vale 30 XP, mais 10 por subtarefa feita e 20 por ciclo de foco. A prioridade organiza sua agenda e não aumenta a recompensa. Os bônus entram no XP quando a tarefa é concluída; minutos de foco e conquistas de Pomodoro contam imediatamente.</p>
        </details>
      </div>
    </div>
  </div>;
}
