'use client';

import { useEffect, useRef } from 'react';

export interface UseAccessibleModalOptions {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  closeOnEscape?: boolean;
}

/**
 * Retorna todos os elementos focáveis visíveis dentro de um contêiner
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return elements.filter((el) => {
    // Garante que o elemento está visível e não oculto
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const style = window.getComputedStyle(el);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) {
        return false;
      }
      if (el.offsetWidth !== undefined) {
        return el.offsetWidth > 0 || el.offsetHeight > 0 || (el.getClientRects && el.getClientRects().length > 0);
      }
    }
    return true;
  });
}

/**
 * Hook de acessibilidade para modais e diálogos:
 * - Foco inicial automático
 * - Contenção de foco (Focus Trap com Tab / Shift+Tab)
 * - Fechamento por Escape
 * - Devolução de foco ao elemento de origem (Return Focus)
 * - Bloqueio de rolagem do fundo
 */
export function useAccessibleModal({
  isOpen,
  onClose,
  initialFocusRef,
  returnFocusRef,
  closeOnEscape = true,
}: UseAccessibleModalOptions) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Salva o elemento que disparou a abertura para devolução posterior
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    // 2. Foco inicial
    const focusTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        const focusables = getFocusableElements(modalRef.current);
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 40);

    // 3. Contenção de foco e Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = getFocusableElements(modalRef.current);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === modalRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    // Bloqueia rolagem do body enquanto o modal estiver aberto
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const elementToReturn = returnFocusRef?.current;

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = originalOverflow;

      // 4. Devolve o foco ao elemento de origem
      const targetToFocus = elementToReturn || previousActiveElementRef.current;
      if (targetToFocus && typeof targetToFocus.focus === 'function') {
        setTimeout(() => {
          try {
            targetToFocus.focus();
          } catch {
            // Ignora se o elemento não existir mais no DOM
          }
        }, 50);
      }
    };
  }, [isOpen, onClose, initialFocusRef, returnFocusRef, closeOnEscape]);

  return { modalRef };
}
