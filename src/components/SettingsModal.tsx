'use client';

import React from 'react';
import { Settings, X, Moon, Bell, Database, Keyboard, ChevronRight } from 'lucide-react';
import { useAccessibleModal } from '../hooks/useAccessibleModal';
import { ThemeToggle } from './ThemeToggle';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBackup: () => void;
  onOpenNotifications: () => void;
  onOpenShortcuts: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenBackup,
  onOpenNotifications,
  onOpenShortcuts,
}) => {
  const { modalRef } = useAccessibleModal({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5b4fe9]/10 text-[#5b4fe9] flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold">Configurações</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Preferências do AppToDo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de configurações"
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#5b4fe9]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options list */}
        <div className="space-y-3">
          {/* Tema */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium block">Aparência</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Tema Claro ou Escuro</span>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Backup */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenBackup();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[#5b4fe9]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[#5b4fe9] flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium block">Backup e Restauração</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Exportar ou importar tarefas (JSON)</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Notificações */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNotifications();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[#5b4fe9]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium block">Notificações e Pomodoro</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Alertas de prazo e ciclo de foco</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Atalhos */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenShortcuts();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[#5b4fe9]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium block">Atalhos de Teclado</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Teclas rápidas para produtividade</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
