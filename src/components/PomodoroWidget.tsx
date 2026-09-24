'use client';

import React from 'react';
import { 
  Play, 
  Pause, 
  Square,
  ChevronUp, 
} from 'lucide-react';
import { PomodoroMode } from '../utils/pomodoroTimer';

interface PomodoroWidgetProps {
  isVisible: boolean;
  isRunning: boolean;
  mode: PomodoroMode;
  formattedTime: string;
  progressPercent: number;
  taskTitle: string | null;
  onToggleRun: () => void;
  onOpenModal: () => void;
  onReset: () => void;
}

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  isVisible,
  isRunning,
  mode,
  formattedTime,
  taskTitle,
  onToggleRun,
  onOpenModal,
  onReset,
}) => {
  // Quando não houver sessão ativa, não renderiza nada (sem timer fictício)
  if (!isVisible) return null;

  const modeLabel = mode === 'focus' ? 'EM FOCO' : 'EM PAUSA';

  return (
    <aside
      aria-label="Controle compacto do Pomodoro"
      className="fixed bottom-14 md:bottom-0 left-0 md:left-60 right-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800 px-4 sm:px-6 py-2.5 sm:py-3 shadow-lg md:shadow-none animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        {/* Lado Esquerdo: Indicador "EM FOCO" + Nome da tarefa vinculada */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-[#5b4fe9] shrink-0 animate-pulse" />
          <div className="min-w-0">
            <span className="block text-[10px] font-bold text-[#5b4fe9] tracking-wider uppercase leading-none mb-1">
              {modeLabel}
            </span>
            <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {taskTitle || 'Sessão de Foco'}
            </p>
          </div>
        </div>

        {/* Lado Direito: Tempo em destaque + Botão play/pause + Encerrar + Pomodoro ⌃ */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Tempo restante em destaque */}
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
            {formattedTime}
          </span>

          {/* Botão de play / pause roxo arredondado */}
          <button
            type="button"
            onClick={onToggleRun}
            title={isRunning ? 'Pausar Pomodoro' : 'Retomar Pomodoro'}
            aria-label={isRunning ? 'Pausar Pomodoro' : 'Retomar Pomodoro'}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#5b4fe9] hover:bg-[#4d40d9] text-white flex items-center justify-center transition-all duration-150 shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#5b4fe9] focus:ring-offset-2"
          >
            {isRunning ? (
              <Pause className="w-4 h-4 fill-white stroke-none" />
            ) : (
              <Play className="w-4 h-4 fill-white stroke-none ml-0.5" />
            )}
          </button>

          {/* Botão de encerrar / parar (Stop square) */}
          <button
            type="button"
            onClick={onReset}
            title="Encerrar sessão de Pomodoro"
            aria-label="Encerrar sessão de Pomodoro"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[#5b4fe9]"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Botão para abrir visualização ampliada do Pomodoro */}
          <button
            type="button"
            onClick={onOpenModal}
            aria-label="Abrir temporizador Pomodoro completo"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[#5b4fe9]"
          >
            <span>Pomodoro</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
