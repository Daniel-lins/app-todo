'use client';

import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { useAccessibleModal } from '../hooks/useAccessibleModal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  // Hook de acessibilidade
  const { modalRef } = useAccessibleModal({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'N', desc: 'Criar nova tarefa rapidamente' },
    { key: '/', desc: 'Focar na barra de pesquisa' },
    { key: 'K', desc: 'Alternar entre visão Lista e Kanban' },
    { key: '?', desc: 'Abrir este painel de atalhos' },
    { key: 'Esc', desc: 'Fechar modais e painéis abertos' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden transition-all text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 id="shortcuts-modal-title" className="text-base font-bold">Atalhos de Teclado</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Navegue com muito mais agilidade</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de atalhos"
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-2.5">
          {shortcuts.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/40"
            >
              <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                {item.desc}
              </span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center mt-5">
          Os atalhos são desativados automaticamente ao digitar em caixas de texto ou com modais abertos.
        </p>
      </div>
    </div>
  );
};
