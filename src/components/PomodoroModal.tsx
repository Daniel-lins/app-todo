'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { TodoItem } from '../types/todo';
import { triggerConfetti } from '../utils/confetti';

interface PomodoroModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TodoItem | null;
  onSessionComplete?: (taskId: string) => void;
}

type Mode = 'focus' | 'break';

const FOCUS_TIME = 25 * 60; // 25 minutes in seconds
const BREAK_TIME = 5 * 60;  // 5 minutes in seconds

export const PomodoroModal: React.FC<PomodoroModalProps> = ({
  isOpen,
  onClose,
  task,
  onSessionComplete,
}) => {
  const [mode, setMode] = useState<Mode>('focus');
  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio effect using Web Audio API (zero external assets needed)
  const playBeep = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio not permitted or failed
    }
  };

  // Reset timer when task or mode changes
  useEffect(() => {
    if (!isOpen) {
      setIsRunning(false);
      return;
    }
    setTimeLeft(mode === 'focus' ? FOCUS_TIME : BREAK_TIME);
    setIsRunning(false);
  }, [mode, isOpen, task]);

  // Main countdown ticker
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            playBeep();
            if (mode === 'focus') {
              triggerConfetti();
              if (task && onSessionComplete) {
                onSessionComplete(task.id);
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, task, onSessionComplete, soundEnabled]);

  if (!isOpen) return null;

  const totalTime = mode === 'focus' ? FOCUS_TIME : BREAK_TIME;
  const progressPercent = ((totalTime - timeLeft) / totalTime) * 100;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const toggleRun = () => setIsRunning((r) => !r);

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? FOCUS_TIME : BREAK_TIME);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-center transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient background blur */}
        <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500 ${
          mode === 'focus' ? 'bg-indigo-500' : 'bg-emerald-500'
        }`} />

        {/* Header bar */}
        <div className="flex items-center justify-between relative z-10 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
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

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              title={soundEnabled ? 'Silenciar som' : 'Ativar som'}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task reference title */}
        {task && (
          <div className="mb-6 px-3 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tarefa Ativa:</span>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
              {task.title}
            </p>
            {task.pomodoros ? (
              <div className="flex items-center gap-1 mt-1 text-xs text-rose-500 font-medium">
                <Flame className="w-3 h-3 fill-rose-500" />
                <span>{task.pomodoros} {task.pomodoros === 1 ? 'sessão concluída' : 'sessões concluídas'}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Mode switcher tabs */}
        <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 mb-6 max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => setMode('focus')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              mode === 'focus'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Foco (25m)
          </button>
          <button
            type="button"
            onClick={() => setMode('break')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
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
                mode === 'focus' ? 'stroke-indigo-600 dark:stroke-indigo-500' : 'stroke-emerald-500'
              }`}
              strokeWidth="6"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - progressPercent / 100)}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-zinc-900 dark:text-white tabular-nums">
              {timeFormatted}
            </span>
            <span className="text-xs text-zinc-400 font-medium mt-1">
              {isRunning ? 'Em andamento' : timeLeft === 0 ? 'Concluído!' : 'Pausado'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            title="Reiniciar tempo"
            className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all hover:scale-105 active:scale-95"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={toggleRun}
            className={`flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-white font-bold text-sm shadow-lg transition-all hover:scale-105 active:scale-95 ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25'
                : mode === 'focus'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/30'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>{timeLeft === 0 ? 'Recomeçar' : 'Iniciar'}</span>
              </>
            )}
          </button>
        </div>

        {timeLeft === 0 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>Ciclo finalizado com sucesso! Parabéns pelo foco.</span>
          </div>
        )}
      </div>
    </div>
  );
};
