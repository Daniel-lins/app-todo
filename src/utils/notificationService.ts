/**
 * Serviço de notificações com definição clara das capacidades reais,
 * prevenção de avisos duplicados para o mesmo prazo e tratamento
 * transparente de permissões e limitações do navegador.
 */

import { TodoItem } from '../types/todo';
import { isTodayLocal, getLocalDateString } from './dateUtils';

export type NotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported';

const NOTIFIED_DEADLINES_KEY = 'apptodo_notified_deadlines_v1';

/**
 * Obtém o status real do suporte a notificações no navegador do usuário.
 */
export function getNotificationStatus(): NotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationStatus;
}

/**
 * Solicita permissão ao usuário com tratamento robusto para todos os resultados.
 */
export async function requestNotificationPermission(): Promise<{
  status: NotificationStatus;
  message?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      status: 'unsupported',
      message: 'Este navegador não suporta notificações web.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      return {
        status: 'denied',
        message:
          'Notificações bloqueadas nas configurações do navegador. Clique no ícone de cadeado/configurações na barra de endereços para permitir avisos.',
      };
    }
    if (permission === 'granted') {
      return {
        status: 'granted',
        message: 'Avisos ativados! Você receberá alertas enquanto o aplicativo estiver aberto.',
      };
    }
    return { status: 'default' };
  } catch (err) {
    console.error('Failed to request notification permission', err);
    return { status: getNotificationStatus() };
  }
}

/**
 * Carrega a lista de prazos que já foram notificados para evitar alertas repetidos.
 */
export function getNotifiedDeadlines(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(NOTIFIED_DEADLINES_KEY);
    if (!raw) return new Set();
    const parsed: string[] = JSON.parse(raw);
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

/**
 * Marca um prazo como já notificado.
 */
export function markDeadlineAsNotified(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getNotifiedDeadlines();
    current.add(key);
    // Limita o tamanho armazenado
    const list = Array.from(current).slice(-100);
    localStorage.setItem(NOTIFIED_DEADLINES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * Envia uma notificação web com tratamento de erro e respeito ao foco da janela.
 */
export function sendAppNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (getNotificationStatus() !== 'granted') return null;

  try {
    return new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
  } catch (err) {
    console.warn('Failed to dispatch notification', err);
    return null;
  }
}

/**
 * Notificação de conclusão de Pomodoro.
 */
export function sendPomodoroNotification(mode: 'focus' | 'break', taskTitle?: string | null): void {
  if (mode === 'focus') {
    const title = '🍅 Pomodoro Concluído!';
    const body = taskTitle
      ? `Você completou 25 minutos de foco na tarefa: "${taskTitle}". Hora de uma pausa!`
      : 'Você completou 25 minutos de foco. Hora de uma pausa!';
    sendAppNotification(title, { body });
  } else {
    sendAppNotification('☕ Pausa Finalizada!', {
      body: 'Sua pausa curta acabou. Pronto para a próxima sessão de foco?',
    });
  }
}

/**
 * Verifica tarefas com prazos para o dia de hoje e envia alertas (sem repetição).
 * Opera estritamente com o aplicativo em execução no navegador.
 */
export function checkDeadlinesAndNotify(
  todos: TodoItem[],
  referenceDate: Date = new Date()
): number {
  if (getNotificationStatus() !== 'granted') return 0;

  const todayStr = getLocalDateString(referenceDate);
  const nowHours = referenceDate.getHours();
  const nowMinutes = referenceDate.getMinutes();
  const nowTotalMinutes = nowHours * 60 + nowMinutes;

  const notifiedSet = getNotifiedDeadlines();
  let sentCount = 0;

  for (const task of todos) {
    if (task.completed || !task.dueDate) continue;

    // Apenas tarefas agendadas para hoje no fuso local
    if (!isTodayLocal(task.dueDate, referenceDate)) continue;

    const deadlineKey = `deadline_${task.id}_${todayStr}_${task.dueTime || 'all_day'}`;

    if (notifiedSet.has(deadlineKey)) {
      continue; // Já foi notificado
    }

    if (task.dueTime) {
      const [hStr, mStr] = task.dueTime.split(':');
      const dueH = parseInt(hStr, 10);
      const dueM = parseInt(mStr, 10);
      if (!isNaN(dueH) && !isNaN(dueM)) {
        const dueTotalMinutes = dueH * 60 + dueM;
        const diffMinutes = dueTotalMinutes - nowTotalMinutes;

        // Avisa se faltam até 15 minutos ou se acabou de atingir o prazo (até 30 min depois)
        if (diffMinutes <= 15 && diffMinutes >= -30) {
          const body =
            diffMinutes > 0
              ? `O prazo para "${task.title}" vence em ${diffMinutes} minuto(s) (às ${task.dueTime}).`
              : `O prazo para "${task.title}" venceu hoje às ${task.dueTime}.`;

          sendAppNotification(`⏰ Prazo de Tarefa: ${task.title}`, { body });
          markDeadlineAsNotified(deadlineKey);
          sentCount++;
        }
      }
    } else {
      // Tarefa para hoje sem horário específico: avisa uma vez durante o dia
      sendAppNotification(`📅 Tarefa para Hoje: ${task.title}`, {
        body: `Você tem uma tarefa agendada para hoje no AppToDo.`,
      });
      markDeadlineAsNotified(deadlineKey);
      sentCount++;
    }
  }

  return sentCount;
}

/**
 * Informações documentadas sobre limites de notificações e execução em segundo plano.
 */
export const NOTIFICATION_LIMITS_DOC = {
  capability: 'Avisos na aba aberta',
  description:
    'Notificações de prazos e Pomodoro são emitidas enquanto o aplicativo estiver aberto em uma aba do navegador.',
  backgroundLimits:
    'Navegadores não executam timers nem emitem notificações web quando todas as abas e o navegador estão fechados sem um servidor dedicado de Web Push (VAPID).',
  antiSpam:
    'Cada prazo de tarefa é notificado no máximo uma vez para evitar alertas repetidos.',
};
