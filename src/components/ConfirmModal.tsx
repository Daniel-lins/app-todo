'use client';

import React, { useRef } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { useAccessibleModal } from '../hooks/useAccessibleModal';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  spaceName: string;
  affectedCount?: number;
  confirmText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  secondaryAction?: {
    label: string;
    description?: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  spaceName,
  affectedCount,
  confirmText = 'Confirmar',
  confirmVariant = 'danger',
  onConfirm,
  secondaryAction,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Hook de acessibilidade: contenção de foco, foco inicial seguro no Cancelar
  const { modalRef } = useAccessibleModal({
    isOpen,
    onClose,
    initialFocusRef: cancelBtnRef,
  });

  if (!isOpen) return null;

  const getButtonStyles = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/25';
      case 'primary':
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden transition-all text-zinc-900 dark:text-zinc-100"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base sm:text-lg font-bold leading-tight">
                {title}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Operação destrutiva ou em massa</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar diálogo de confirmação"
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Space Context & Affected info badge */}
        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60 mb-4 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span>Espaço afetado:</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/60">
              {spaceName}
            </span>
          </div>
          {typeof affectedCount === 'number' && (
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Tarefas impactadas:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {affectedCount} {affectedCount === 1 ? 'tarefa' : 'tarefas'}
              </span>
            </div>
          )}
        </div>

        {/* Description body */}
        <p id="confirm-modal-desc" className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mb-6 leading-relaxed">
          {description}
        </p>

        {/* Secondary Action Option (e.g. Append instead of replace) */}
        {secondaryAction && (
          <div className="mb-4 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                {secondaryAction.label}
              </p>
              {secondaryAction.description && (
                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400 mt-0.5">
                  {secondaryAction.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                secondaryAction.onClick();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shrink-0 min-h-[36px]"
            >
              Escolher
            </button>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[40px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 min-h-[40px] ${getButtonStyles()}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
