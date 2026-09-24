'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TodoItem } from '../types/todo';
import {
  PomodoroSession,
  PomodoroMode,
  FOCUS_DURATION,
  BREAK_DURATION,
  createInitialPomodoroSession,
  startPomodoroTimer,
  pausePomodoroTimer,
  resetPomodoroTimer,
  switchPomodoroMode,
  tickPomodoroTimer,
  syncPomodoroWithTasks,
  savePomodoroState,
  loadPomodoroState,
  playPomodoroBeep,
  prefersReducedMotion,
} from '../utils/pomodoroTimer';
import { triggerConfetti } from '../utils/confetti';
import { sendPomodoroNotification } from '../utils/notificationService';

interface UsePomodoroOptions {
  todos: TodoItem[];
  onSessionComplete?: (taskId: string) => void;
}

export function usePomodoro({ todos, onSessionComplete }: UsePomodoroOptions) {
  const [session, setSession] = useState<PomodoroSession>(() => {
    if (typeof window === 'undefined') {
      return createInitialPomodoroSession();
    }
    const { session: loaded } = loadPomodoroState(todos, Date.now());
    return loaded;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const savedSound = localStorage.getItem('apptodo_pomodoro_sound');
      return savedSound !== null ? savedSound === 'true' : true;
    } catch {
      return true;
    }
  });
  const isMountedRef = useRef(false);

  const onSessionCompleteRef = useRef(onSessionComplete);
  useEffect(() => {
    onSessionCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  // Ajusta a sessão se a tarefa vinculada foi modificada/removida durante a renderização
  const currentSynced = syncPomodoroWithTasks(session, todos);
  if (currentSynced !== session) {
    setSession(currentSynced);
    savePomodoroState(currentSynced);
  }

  // Carrega e reconcilia o estado salvo no localStorage na montagem
  useEffect(() => {
    isMountedRef.current = true;
    const { completedDuringReload, session: loadedSession } = loadPomodoroState(todos, Date.now());

    if (completedDuringReload) {
      playPomodoroBeep(soundEnabled);
      if (!prefersReducedMotion()) {
        triggerConfetti();
      }
      sendPomodoroNotification(loadedSession.mode, loadedSession.taskTitle);
      if (loadedSession.mode === 'focus' && loadedSession.taskId && onSessionCompleteRef.current) {
        onSessionCompleteRef.current(loadedSession.taskId);
      }
    }
  }, [todos, soundEnabled]); // Mount & check

  // Persiste alterações do timer
  useEffect(() => {
    if (!isMountedRef.current) return;
    savePomodoroState(session);
  }, [session]);

  // Loop principal do timer com timestamp absoluto resistente a atrasos de abas em segundo plano
  useEffect(() => {
    if (!session.isRunning) return;

    const intervalId = setInterval(() => {
      setSession((prev) => {
        const { session: updated, completedNow } = tickPomodoroTimer(prev, Date.now());

        if (completedNow) {
          playPomodoroBeep(soundEnabled);
          if (!prefersReducedMotion()) {
            triggerConfetti();
          }
          sendPomodoroNotification(prev.mode, prev.taskTitle);

          if (prev.mode === 'focus' && prev.taskId && onSessionCompleteRef.current) {
            onSessionCompleteRef.current(prev.taskId);
          }
        }

        return updated;
      });
    }, 500);

    return () => clearInterval(intervalId);
  }, [session.isRunning, soundEnabled]);

  // Reconcilia imediatamente quando a aba volta a ficar visível
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setSession((prev) => {
          if (!prev.isRunning) return prev;
          const { session: updated, completedNow } = tickPomodoroTimer(prev, Date.now());
          if (completedNow) {
            playPomodoroBeep(soundEnabled);
            if (!prefersReducedMotion()) {
              triggerConfetti();
            }
            sendPomodoroNotification(prev.mode, prev.taskTitle);
            if (prev.mode === 'focus' && prev.taskId && onSessionCompleteRef.current) {
              onSessionCompleteRef.current(prev.taskId);
            }
          }
          return updated;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [soundEnabled]);

  // Ações do Timer
  const start = useCallback(() => {
    setSession((prev) => {
      const next = startPomodoroTimer(prev, Date.now());
      savePomodoroState(next);
      return next;
    });
  }, []);

  const pause = useCallback(() => {
    setSession((prev) => {
      const next = pausePomodoroTimer(prev, Date.now());
      savePomodoroState(next);
      return next;
    });
  }, []);

  const toggleRun = useCallback(() => {
    setSession((prev) => {
      const next = prev.isRunning
        ? pausePomodoroTimer(prev, Date.now())
        : startPomodoroTimer(prev, Date.now());
      savePomodoroState(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSession((prev) => {
      const next = resetPomodoroTimer(prev, Date.now());
      savePomodoroState(next);
      return next;
    });
  }, []);

  const setMode = useCallback((newMode: PomodoroMode) => {
    setSession((prev) => {
      const next = switchPomodoroMode(prev, newMode, Date.now());
      savePomodoroState(next);
      return next;
    });
  }, []);

  const bindTask = useCallback((task: TodoItem | null) => {
    setSession((prev) => {
      const next: PomodoroSession = {
        ...prev,
        taskId: task?.id || null,
        taskTitle: task?.title || null,
      };
      savePomodoroState(next);
      return next;
    });
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('apptodo_pomodoro_sound', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Formatação amigável
  const minutes = Math.floor(session.remainingSeconds / 60);
  const seconds = session.remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalDuration = session.mode === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - session.remainingSeconds) / totalDuration) * 100));

  // Indica se o timer está ativo ou em andamento (para controle compacto)
  const isTimerActive = session.isRunning || session.remainingSeconds < session.durationSeconds;

  return {
    session,
    timeLeft: session.remainingSeconds,
    duration: session.durationSeconds,
    isRunning: session.isRunning,
    mode: session.mode,
    taskTitle: session.taskTitle,
    taskId: session.taskId,
    progressPercent,
    formattedTime,
    isModalOpen,
    isTimerActive,
    soundEnabled,
    start,
    pause,
    toggleRun,
    reset,
    setMode,
    bindTask,
    toggleSound,
    openModal,
    closeModal,
  };
}
