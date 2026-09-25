'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TodoItem } from '../types/todo';
import {
  type PomodoroSession, type PomodoroMode, FOCUS_DURATION, BREAK_DURATION,
  POMODORO_STORAGE_KEY, createInitialPomodoroSession, startPomodoroTimer,
  pausePomodoroTimer, resetPomodoroTimer, switchPomodoroMode,
  savePomodoroState, loadPomodoroState,
  playPomodoroBeep, prefersReducedMotion,
} from '../utils/pomodoroTimer';
import { triggerConfetti } from '../utils/confetti';
import { sendPomodoroNotification } from '../utils/notificationService';

interface UsePomodoroOptions {
  todos: TodoItem[];
  isLoaded: boolean;
  contextId: string;
  onSessionComplete?: (taskId: string, sessionId: string) => void | Promise<void>;
}

export function usePomodoro({ todos, isLoaded, contextId, onSessionComplete }: UsePomodoroOptions) {
  const [session, setSession] = useState<PomodoroSession>(createInitialPomodoroSession);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return typeof window === 'undefined' || localStorage.getItem('apptodo_pomodoro_sound') !== 'false'; } catch { return true; }
  });
  const [timerError, setTimerError] = useState<string | null>(null);
  const sessionRef = useRef(session);
  const latest = useRef({ todos, onSessionComplete, soundEnabled });
  useEffect(() => { latest.current = { todos, onSessionComplete, soundEnabled }; }, [todos, onSessionComplete, soundEnabled]);
  const storageKey = contextId === 'guest' ? POMODORO_STORAGE_KEY : `${POMODORO_STORAGE_KEY}_${contextId}`;

  const publish = useCallback((next: PomodoroSession) => {
    if (JSON.stringify(next) === JSON.stringify(sessionRef.current)) return;
    savePomodoroState(next, storageKey);
    sessionRef.current = next;
    setSession(next);
  }, [storageKey]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    const reconcile = async () => {
      const work = async () => {
        if (cancelled) return;
        const current = latest.current;
        const { session: loaded, completedDuringReload } = loadPomodoroState(current.todos, Date.now(), storageKey, false);
        if (completedDuringReload && loaded.mode === 'focus' && loaded.taskId) {
          // The task stores the session ID; retrying a completion cannot count it twice.
          await current.onSessionComplete?.(loaded.taskId, loaded.sessionId);
        }
        if (cancelled) return;
        publish(loaded);
        setTimerError(null);
        if (completedDuringReload) {
          playPomodoroBeep(current.soundEnabled);
          if (!prefersReducedMotion()) triggerConfetti();
          sendPomodoroNotification(loaded.mode, loaded.taskTitle);
        }
      };
      try {
        if (navigator.locks) await navigator.locks.request(`timer-${storageKey}`, work);
        else await work();
      } catch (error) {
        if (!cancelled) setTimerError(error instanceof Error ? error.message : 'Não foi possível registrar a sessão de foco.');
      }
    };
    void reconcile();
    const interval = setInterval(() => { void reconcile(); }, 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') void reconcile(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isLoaded, storageKey, publish]);

  const change = useCallback((transform: (value: PomodoroSession) => PomodoroSession) => {
    if (!isLoaded) return;
    publish(transform(sessionRef.current));
  }, [isLoaded, publish]);
  const start = useCallback(() => change(s => startPomodoroTimer(s)), [change]);
  const pause = useCallback(() => change(s => pausePomodoroTimer(s)), [change]);
  const toggleRun = useCallback(() => change(s => s.isRunning ? pausePomodoroTimer(s) : startPomodoroTimer(s)), [change]);
  const reset = useCallback(() => change(s => resetPomodoroTimer(s)), [change]);
  const setMode = useCallback((mode: PomodoroMode) => change(s => switchPomodoroMode(s, mode)), [change]);
  const bindTask = useCallback((task: TodoItem | null) => change(s => ({ ...s, taskId: task?.id || null, taskTitle: task?.title || null })), [change]);
  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    try { localStorage.setItem('apptodo_pomodoro_sound', String(next)); } catch { /* Sound remains usable. */ }
    setSoundEnabled(next);
  }, [soundEnabled]);
  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const minutes = Math.floor(session.remainingSeconds / 60);
  const seconds = session.remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const duration = session.mode === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
  const progressPercent = Math.min(100, Math.max(0, ((duration - session.remainingSeconds) / duration) * 100));
  return {
    session, timeLeft: session.remainingSeconds, duration: session.durationSeconds,
    isRunning: session.isRunning, mode: session.mode, taskTitle: session.taskTitle, taskId: session.taskId,
    formattedTime, progressPercent, isModalOpen,
    isTimerActive: session.isRunning || session.remainingSeconds < session.durationSeconds,
    soundEnabled, timerError, start, pause, toggleRun, reset, setMode, bindTask, toggleSound, openModal, closeModal,
  };
}
