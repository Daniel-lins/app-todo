'use client';

import React from 'react';
import { 
  Bell, 
  BellRing, 
  BellOff, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ShieldAlert
} from 'lucide-react';
import { 
  NotificationStatus, 
  requestNotificationPermission, 
  sendAppNotification, 
  NOTIFICATION_LIMITS_DOC 
} from '../utils/notificationService';
import { useAccessibleModal } from '../hooks/useAccessibleModal';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: NotificationStatus;
  onStatusChange: (newStatus: NotificationStatus) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusChange,
}) => {
  // Hook de acessibilidade: contenção de foco, foco inicial e devolução
  const { modalRef } = useAccessibleModal({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleRequest = async () => {
    const res = await requestNotificationPermission();
    onStatusChange(res.status);
    if (res.status === 'granted') {
      sendAppNotification('AppToDo - Notificações Ativadas! 🔔', {
        body: 'Você receberá avisos sobre seus prazos e sessões de foco enquanto o app estiver aberto.',
      });
    }
  };

  const handleSendTest = () => {
    sendAppNotification('🔔 Teste de Notificação - AppToDo', {
      body: 'Seu sistema de avisos está funcionando perfeitamente na aba aberta!',
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-2xl ${
              status === 'granted'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : status === 'denied'
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
            }`}>
              {status === 'granted' ? (
                <BellRing className="w-5 h-5" />
              ) : status === 'denied' ? (
                <BellOff className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 id="notification-modal-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                Notificações & Avisos
              </h2>
              <span className={`text-[11px] font-semibold ${
                status === 'granted'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : status === 'denied'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-zinc-500'
              }`}>
                {status === 'granted'
                  ? 'Ativadas para a aba aberta'
                  : status === 'denied'
                  ? 'Bloqueadas pelo navegador'
                  : status === 'unsupported'
                  ? 'Não suportadas neste navegador'
                  : 'Aguardando ativação'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de notificações"
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Content */}
        <div className="space-y-4 text-xs text-zinc-600 dark:text-zinc-300">
          {status === 'granted' && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/30 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Alertas ativos na aba aberta</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Você receberá notificações na tela para:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-zinc-600 dark:text-zinc-400">
                <li>Prazos de tarefas agendadas para o dia de hoje (sem avisos repetidos).</li>
                <li>Finalização de sessões de foco e pausas no Pomodoro.</li>
              </ul>
            </div>
          )}

          {status === 'denied' && (
            <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/30 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-300">
                <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Permissão negada nas configurações</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                O navegador bloqueou as notificações deste site. Para reativá-las:
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-zinc-600 dark:text-zinc-400">
                <li>Clique no ícone de <strong>cadeado ou configurações</strong> na barra de endereços do navegador.</li>
                <li>Altere a opção <strong>Notificações</strong> para <strong>Permitir</strong>.</li>
                <li>Recarregue a página.</li>
              </ol>
            </div>
          )}

          {status === 'unsupported' && (
            <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/30 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Recurso não disponível</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Seu navegador atual não suporta a API de Notificações do sistema operacional.
              </p>
            </div>
          )}

          {status === 'default' && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/30 space-y-2">
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Ative as notificações para receber avisos sobre os prazos das suas tarefas e conclusão das sessões Pomodoro enquanto você utiliza o aplicativo.
              </p>
            </div>
          )}

          {/* Transparência e limites honestos */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <strong>Como funcionam os avisos:</strong> {NOTIFICATION_LIMITS_DOC.description} {NOTIFICATION_LIMITS_DOC.backgroundLimits}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
          {status === 'default' && (
            <button
              type="button"
              onClick={handleRequest}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Permitir Notificações</span>
            </button>
          )}

          {status === 'granted' && (
            <button
              type="button"
              onClick={handleSendTest}
              className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5 text-emerald-500" />
              <span>Enviar Notificação de Teste</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
