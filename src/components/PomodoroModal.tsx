'use client';

import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  Flame, 
  Coffee, 
  Volume2, 
  VolumeX,
  CheckCircle2
} from 'lucide-react';
import { PomodoroMode, PomodoroSession } from '../utils/pomodoroTimer';
import { useAccessibleModal } from '../hooks/useAccessibleModal';

interface PomodoroModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: PomodoroSession;
  timeLeft?: number;
  isRunning: boolean;
  mode: PomodoroMode;
  taskTitle: string | null;
  progressPercent: number;
  formattedTime: string;
  soundEnabled: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  onSetMode: (mode: PomodoroMode) => void;
  onToggleSound: () => void;
}

export const PomodoroModal: React.FC<PomodoroModalProps> = ({
  isOpen,
  onClose,
  session,
  isRunning,
  mode,
  taskTitle,
  progressPercent,
  formattedTime,
  soundEnabled,
  onToggleRun,
  onReset,
  onSetMode,
  onToggleSound,
}) => {
  // Hook de acessibilidade: foco inicial, contenção de foco e devolução de foco
  const { modalRef } = useAccessibleModal({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-center transition-all"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pomodoro-modal-title"
      >
        {/* Ambient background blur */}
        <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500 ${
          mode === 'focus' ? 'bg-indigo-500' : 'bg-emerald-500'
        }`} />

        {/* Header bar */}
        <div className="flex items-center justify-between relative z-10 mb-4">
          <div className="flex items-center gap-2">
            <h2 id="pomodoro-modal-title" className="text-sm font-bold text-zinc-900 dark:text-zinc-100 sr-only">
              Temporizador Pomodoro
            </h2>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {mode === 'focus' ? (
                <>
                  <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span>Modo Foco</span>
                </>
              ) : (
                <>
                  <Coffee className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Pausa Curta</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleSound}
              title={soundEnabled ? 'Silenciar som' : 'Ativar som'}
              aria-label={soundEnabled ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar (o timer continua rodando em segundo plano)"
              aria-label="Fechar temporizador Pomodoro"
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task reference title */}
        {taskTitle && (
          <div className="mb-6 px-3 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Tarefa Ativa:</span>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
              {taskTitle}
            </p>
          </div>
        )}

        {/* Mode switcher tabs */}
        <div 
          role="group" 
          aria-label="Modo de Pomodoro"
          className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 mb-6 max-w-xs mx-auto"
        >
          <button
            type="button"
            onClick={() => onSetMode('focus')}
            aria-pressed={mode === 'focus'}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all min-h-[36px] ${
              mode === 'focus'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Foco (25m)
          </button>
          <button
            type="button"
            onClick={() => onSetMode('break')}
            aria-pressed={mode === 'break'}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all min-h-[36px] ${
              mode === 'break'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Pausa (5m)
          </button>
        </div>

        {/* Circular Progress & Timer */}
        <div className="relative w-56 h-56 mx-auto mb-6 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="44"
              className="stroke-zinc-100 dark:stroke-zinc-800/80"
              strokeWidth="6"
              fill="transparent"
            />
            {/* Active progress ring */}
            <circle
              cx="50"
              cy="50"
              r="44"
              className={`transition-all duration-1000 ease-linear ${
                mode === 'focus' ? 'stroke-indigo-600' : 'stroke-emerald-500'
              }`}
              strokeWidth="6"
              strokeDasharray={276.46}
              strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Time digits */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span 
              className="text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 font-mono"
              aria-live="polite"
            >
              {formattedTime}
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">
              {isRunning ? 'Em andamento' : 'Pausado'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            type="button"
            onClick={onReset}
            title="Reiniciar contador"
            aria-label="Reiniciar contador Pomodoro"
            className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onToggleRun}
            aria-label={isRunning ? 'Pausar Pomodoro' : 'Iniciar Pomodoro'}
            className={`px-8 py-3.5 rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 text-white min-h-[44px] ${
              mode === 'focus'
                ? 'bg-[#5b4fe9] hover:bg-[#4d40d9] shadow-indigo-500/25'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/25'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current ml-0.5" />
                <span>Iniciar</span>
              </>
            )}
          </button>
        </div>

        {/* Sessions completed count */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>
            {session.completedSessionIds?.length ?? 0}{' '}
            {(session.completedSessionIds?.length ?? 0) === 1 ? 'ciclo recente concluído' : 'ciclos recentes concluídos'}
          </span>
        </div>
      </div>
    </div>
  );
};
