"use client";
import { Bell, CheckCheck, X } from "lucide-react";
import type { InAppNotice } from "../utils/inAppNotifications";
import type { TodoItem } from "../types/todo";
import { useAccessibleModal } from "../hooks/useAccessibleModal";
export function NotificationBell({
  unread,
  onClick,
}: {
  unread: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Notificações, ${unread} não lidas`}
      className="relative min-w-11 min-h-11 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-indigo-500"
    >
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold leading-4"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
export function InAppInbox({
  items,
  tasks,
  error,
  onClose,
  onRead,
  onTask,
  onSettings,
}: {
  items: InAppNotice[];
  tasks: TodoItem[];
  error: string;
  onClose: () => void;
  onRead: (id?: string) => boolean;
  onTask: (task: TodoItem) => void;
  onSettings: () => void;
}) {
  const { modalRef } = useAccessibleModal({ isOpen: true, onClose });
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbox-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85dvh] flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
      >
        <header className="flex items-center justify-between gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 id="inbox-title" className="text-lg font-semibold">
            Notificações
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar notificações"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={20} />
          </button>
        </header>
        <div className="p-4 flex flex-wrap gap-2 border-b border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            disabled={!items.some((x) => !x.read)}
            onClick={() => onRead()}
            className="min-h-11 px-3 flex gap-2 items-center rounded-lg text-sm border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
          >
            <CheckCheck size={16} />
            Marcar todas como lidas
          </button>
          <button
            type="button"
            onClick={onSettings}
            className="min-h-11 px-3 text-sm text-indigo-700 dark:text-indigo-300"
          >
            Configurar avisos do navegador
          </button>
        </div>
        <div className="overflow-y-auto min-h-0 p-4 space-y-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Avisos deste espaço, guardados neste navegador. São atualizados ao
            abrir o app e enquanto ele estiver aberto. Não exigem permissão do
            navegador.
          </p>
          {error && (
            <p
              role="alert"
              className="text-sm text-rose-600 dark:text-rose-400"
            >
              {error}
            </p>
          )}
          {!items.length && (
            <p className="py-6 text-sm text-zinc-600 dark:text-zinc-400">
              Tudo tranquilo por aqui. Seus próximos avisos de início, prazo e
              foco aparecerão nesta central.
            </p>
          )}
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item) => {
              const task = tasks.find((t) => t.id === item.taskId);
              return (
                <li
                  key={item.id}
                  className={`py-4 space-y-2 ${item.read ? "" : "font-medium"}`}
                >
                  <div className="flex items-start gap-2">
                    {!item.read && (
                      <span
                        className="mt-1.5 h-2 w-2 rounded-full bg-indigo-600 shrink-0"
                        aria-label="Não lida"
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="text-sm">{item.title}</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 break-words mt-1">
                        {item.body}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-normal text-zinc-600 dark:text-zinc-400">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {task && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onRead(item.id)) onTask(task);
                        }}
                        className="min-h-11 px-3 rounded-lg text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                      >
                        Abrir tarefa
                      </button>
                    )}
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => onRead(item.id)}
                        className="min-h-11 px-3 rounded-lg text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                  {!task && item.taskId && (
                    <p className="text-xs font-normal text-zinc-600 dark:text-zinc-400">
                      Esta tarefa não está mais neste espaço.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
