/**
 * Lógica pura do Pomodoro, resistente a atrasos de intervalo,
 * independente da abertura do modal, com deduplicação de conclusão
 * e controle de recursos de áudio.
 */

import { TodoItem } from '../types/todo';

export type PomodoroMode = 'focus' | 'break';

export const FOCUS_DURATION = 25 * 60; // 25 minutos em segundos (1500s)
export const BREAK_DURATION = 5 * 60;  // 5 minutos em segundos (300s)

export interface PomodoroSession {
  sessionId: string;
  mode: PomodoroMode;
  durationSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  targetEndTime: number | null; // Timestamp absoluto em ms quando em execução
  lastUpdated: number;          // Timestamp do último cálculo
  taskId: string | null;
  taskTitle: string | null;
  completedSessionIds: string[]; // Registro de sessões concluídas para evitar contabilização duplicada
}

export const POMODORO_STORAGE_KEY = 'apptodo_pomodoro_state_v1';

/**
 * Cria um estado inicial limpo de sessão Pomodoro.
 */
export function createInitialPomodoroSession(
  mode: PomodoroMode = 'focus',
  task: TodoItem | null = null
): PomodoroSession {
  const duration = mode === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
  return {
    sessionId: `pomo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    mode,
    durationSeconds: duration,
    remainingSeconds: duration,
    isRunning: false,
    targetEndTime: null,
    lastUpdated: Date.now(),
    taskId: task?.id || null,
    taskTitle: task?.title || null,
    completedSessionIds: [],
  };
}

/**
 * Inicia ou retoma a contagem do timer baseado no horário absoluto (timestamp).
 */
export function startPomodoroTimer(
  session: PomodoroSession,
  now: number = Date.now()
): PomodoroSession {
  if (session.isRunning) return session;

  // Se o tempo restante for 0, reinicia a sessão antes de iniciar
  const remaining = session.remainingSeconds <= 0 ? session.durationSeconds : session.remainingSeconds;
  const newSessionId =
    session.remainingSeconds <= 0
      ? `pomo-${now}-${Math.random().toString(36).substring(2, 6)}`
      : session.sessionId;

  return {
    ...session,
    sessionId: newSessionId,
    remainingSeconds: remaining,
    isRunning: true,
    targetEndTime: now + remaining * 1000,
    lastUpdated: now,
  };
}

/**
 * Pausa a contagem, calculando com precisão o tempo restante real.
 */
export function pausePomodoroTimer(
  session: PomodoroSession,
  now: number = Date.now()
): PomodoroSession {
  if (!session.isRunning || !session.targetEndTime) {
    return { ...session, isRunning: false, targetEndTime: null, lastUpdated: now };
  }

  const remainingMs = session.targetEndTime - now;
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  return {
    ...session,
    isRunning: false,
    remainingSeconds,
    targetEndTime: null,
    lastUpdated: now,
  };
}

/**
 * Reinicia o tempo da sessão atual para a duração total.
 */
export function resetPomodoroTimer(
  session: PomodoroSession,
  now: number = Date.now()
): PomodoroSession {
  const duration = session.mode === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
  return {
    ...session,
    sessionId: `pomo-${now}-${Math.random().toString(36).substring(2, 6)}`,
    durationSeconds: duration,
    remainingSeconds: duration,
    isRunning: false,
    targetEndTime: null,
    lastUpdated: now,
  };
}

/**
 * Altera entre Modo Foco (25m) e Modo Pausa (5m).
 */
export function switchPomodoroMode(
  session: PomodoroSession,
  newMode: PomodoroMode,
  now: number = Date.now()
): PomodoroSession {
  const duration = newMode === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
  return {
    ...session,
    sessionId: `pomo-${now}-${Math.random().toString(36).substring(2, 6)}`,
    mode: newMode,
    durationSeconds: duration,
    remainingSeconds: duration,
    isRunning: false,
    targetEndTime: null,
    lastUpdated: now,
  };
}

/**
 * Atualiza o timer com base no timestamp real.
 * Retorna a sessão atualizada e se uma nova conclusão deve ser registrada (apenas uma vez por sessionId).
 */
export function tickPomodoroTimer(
  session: PomodoroSession,
  now: number = Date.now()
): {
  session: PomodoroSession;
  completedNow: boolean;
} {
  if (!session.isRunning || !session.targetEndTime) {
    return { session, completedNow: false };
  }

  const remainingMs = session.targetEndTime - now;
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  if (remainingSeconds <= 0) {
    // Timer finalizou
    const alreadyCompleted = session.completedSessionIds.includes(session.sessionId);
    const completedNow = !alreadyCompleted;

    const nextCompletedList = alreadyCompleted
      ? session.completedSessionIds
      : [...session.completedSessionIds.slice(-20), session.sessionId]; // Mantém histórico recente

    return {
      session: {
        ...session,
        remainingSeconds: 0,
        isRunning: false,
        targetEndTime: null,
        lastUpdated: now,
        completedSessionIds: nextCompletedList,
      },
      completedNow,
    };
  }

  return {
    session: {
      ...session,
      remainingSeconds,
      lastUpdated: now,
    },
    completedNow: false,
  };
}

/**
 * Sincroniza a sessão com a lista atual de tarefas (trata exclusão ou alteração de título).
 */
export function syncPomodoroWithTasks(
  session: PomodoroSession,
  todos: TodoItem[]
): PomodoroSession {
  if (!session.taskId) return session;

  const currentTask = todos.find((t) => t.id === session.taskId);
  if (!currentTask) {
    // Tarefa foi excluída ou desvinculada
    return {
      ...session,
      taskId: null,
      taskTitle: '(Tarefa removida)',
    };
  }

  if (currentTask.title !== session.taskTitle) {
    return {
      ...session,
      taskTitle: currentTask.title,
    };
  }

  return session;
}

/**
 * Salva a sessão no localStorage com tratamento de exceções.
 */
export function savePomodoroState(session: PomodoroSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to save Pomodoro state to localStorage', err);
  }
}

/**
 * Carrega a sessão do localStorage e reconcilia com o horário real caso o timer estivesse correndo.
 */
export function loadPomodoroState(
  todos: TodoItem[] = [],
  now: number = Date.now()
): {
  session: PomodoroSession;
  completedDuringReload: boolean;
} {
  if (typeof window === 'undefined') {
    return { session: createInitialPomodoroSession(), completedDuringReload: false };
  }

  try {
    const raw = localStorage.getItem(POMODORO_STORAGE_KEY);
    if (!raw) {
      return { session: createInitialPomodoroSession(), completedDuringReload: false };
    }

    const parsed: PomodoroSession = JSON.parse(raw);
    const synced = syncPomodoroWithTasks(parsed, todos);

    // Se estava rodando, reconcilia com o tempo decorrido enquanto a página estava fechada/recarregando
    if (synced.isRunning && synced.targetEndTime) {
      const { session: updated, completedNow } = tickPomodoroTimer(synced, now);
      savePomodoroState(updated);
      return { session: updated, completedDuringReload: completedNow };
    }

    return { session: synced, completedDuringReload: false };
  } catch (err) {
    console.error('Failed to parse Pomodoro state from localStorage', err);
    return { session: createInitialPomodoroSession(), completedDuringReload: false };
  }
}

/**
 * Reproduz o feedback sonoro utilizando a Web Audio API garantindo
 * a liberação explícita do contexto de áudio (`ctx.close()`) para evitar vazamento de memória.
 */
export function playPomodoroBeep(soundEnabled = true): void {
  if (!soundEnabled || typeof window === 'undefined') return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

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

    // Libera os recursos de áudio do navegador imediatamente ao terminar
    osc.onended = () => {
      ctx.close().catch(() => {});
    };

    // Timeout de segurança caso onended não dispare no navegador
    setTimeout(() => {
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    }, 1000);
  } catch {
    // Permissão de áudio não concedida ou navegador sem suporte
  }
}

/**
 * Verifica se o usuário prefere movimento reduzido (acessibilidade).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
