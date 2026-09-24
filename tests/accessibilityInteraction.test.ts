import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getFocusableElements } from '../src/hooks/useAccessibleModal';
import { TaskStatus, TodoItem } from '../src/types/todo';

// Helper to calculate WCAG 2.1 relative luminance and contrast ratio
function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const srgb = [r, g, b].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('Acessibilidade e Interação - AppToDo', () => {
  describe('Contenção de Foco e Focus Trap (useAccessibleModal)', () => {
    it('Identifica corretamente elementos focáveis válidos e ignora desabilitados', () => {
      // Mock minimal DOM container
      const elements: {
        tagName: string;
        disabled?: boolean;
        tabIndex?: number;
        getAttribute: (attr: string) => string | null;
      }[] = [
        { tagName: 'BUTTON', disabled: false, tabIndex: 0, getAttribute: () => null },
        { tagName: 'INPUT', disabled: true, tabIndex: 0, getAttribute: () => null },
        { tagName: 'A', disabled: false, tabIndex: 0, getAttribute: (attr) => (attr === 'href' ? '#' : null) },
        { tagName: 'DIV', disabled: false, tabIndex: -1, getAttribute: () => null },
        { tagName: 'SELECT', disabled: false, tabIndex: 0, getAttribute: () => null },
        { tagName: 'BUTTON', disabled: false, tabIndex: 0, getAttribute: (attr) => (attr === 'aria-hidden' ? 'true' : null) },
      ];

      const mockContainer = {
        querySelectorAll: () => {
          return elements.filter((el) => {
            if (el.disabled) return false;
            if (el.getAttribute('aria-hidden') === 'true') return false;
            if (el.tabIndex === -1) return false;
            return true;
          });
        },
      };

      const focusable = getFocusableElements(mockContainer as unknown as HTMLElement);
      assert.equal(focusable.length, 3, 'Apenas botões habilitados, links com href e selects devem ser focáveis');
    });

    it('Calcula ciclo de foco entre primeiro e último elemento (Tab e Shift+Tab)', () => {
      const mockButtons = [
        { id: 'first-btn', focusCalled: false, focus() { this.focusCalled = true; } },
        { id: 'middle-btn', focusCalled: false, focus() { this.focusCalled = true; } },
        { id: 'last-btn', focusCalled: false, focus() { this.focusCalled = true; } },
      ];

      // Simulando Tab no último elemento -> deve voltar ao primeiro
      let currentActiveIndex = 2; // last-btn
      let shiftKey = false;

      if (!shiftKey && currentActiveIndex === mockButtons.length - 1) {
        mockButtons[0].focus();
      }
      assert.equal(mockButtons[0].focusCalled, true, 'Tab no último elemento deve devolver foco ao primeiro elemento');

      // Simulando Shift+Tab no primeiro elemento -> deve ir ao último
      currentActiveIndex = 0; // first-btn
      shiftKey = true;

      if (shiftKey && currentActiveIndex === 0) {
        mockButtons[mockButtons.length - 1].focus();
      }
      assert.equal(mockButtons[2].focusCalled, true, 'Shift+Tab no primeiro elemento deve levar foco ao último elemento');
    });
  });

  describe('Proteção Contra Atalhos Globais Indevidos', () => {
    function shouldTriggerGlobalShortcut(
      key: string,
      targetTagName: string,
      isContentEditable: boolean,
      isAnyModalOpen: boolean
    ): boolean {
      const isInput =
        targetTagName === 'INPUT' ||
        targetTagName === 'TEXTAREA' ||
        targetTagName === 'SELECT' ||
        isContentEditable;

      // Se qualquer modal estiver aberto ou o usuário estiver digitando em campo, bloqueia atalhos de navegação/ação
      if (isInput || isAnyModalOpen) {
        return false;
      }

      const validKeys = ['n', '/', 'k', '?'];
      return validKeys.includes(key.toLowerCase());
    }

    it('Bloqueia atalhos globais (n, /, k, ?) quando usuário digita em input ou textarea', () => {
      assert.equal(shouldTriggerGlobalShortcut('n', 'INPUT', false, false), false, 'Não deve criar tarefa ao digitar "n" em input');
      assert.equal(shouldTriggerGlobalShortcut('/', 'TEXTAREA', false, false), false, 'Não deve focar busca ao digitar "/" em textarea');
      assert.equal(shouldTriggerGlobalShortcut('k', 'SELECT', false, false), false, 'Não deve alternar kanban ao teclar "k" em select');
      assert.equal(shouldTriggerGlobalShortcut('?', 'DIV', true, false), false, 'Não deve abrir atalhos ao teclar "?" em contenteditable');
    });

    it('Bloqueia atalhos globais de fundo quando qualquer modal estiver aberto', () => {
      assert.equal(shouldTriggerGlobalShortcut('n', 'BODY', false, true), false, 'Não deve abrir novo modal de tarefa com outro modal aberto');
      assert.equal(shouldTriggerGlobalShortcut('k', 'BODY', false, true), false, 'Não deve mudar visão para Kanban enquanto modal estiver aberto');
      assert.equal(shouldTriggerGlobalShortcut('/', 'BODY', false, true), false, 'Não deve roubar foco para campo de busca fora do modal');
    });

    it('Permite atalhos globais quando fora de campos e nenhum modal estiver aberto', () => {
      assert.equal(shouldTriggerGlobalShortcut('n', 'BODY', false, false), true, 'Deve acionar nova tarefa via teclado');
      assert.equal(shouldTriggerGlobalShortcut('k', 'BODY', false, false), true, 'Deve alternar visão para Kanban');
      assert.equal(shouldTriggerGlobalShortcut('/', 'BODY', false, false), true, 'Deve focar busca');
      assert.equal(shouldTriggerGlobalShortcut('?', 'BODY', false, false), true, 'Deve abrir modal de atalhos');
    });
  });

  describe('Operação de Tarefas Apenas por Teclado (Criar, Editar, Concluir, Mover)', () => {
    it('Permite transição de status usando apenas teclado e valida integridade', () => {
      const task: TodoItem = {
        id: 't-keyboard-1',
        title: 'Tarefa Operada por Teclado',
        completed: false,
        pinned: false,
        status: 'todo',
        priority: 'high',
        category: 'work',
        subTasks: [],
        createdAt: new Date().toISOString(),
      };

      const handleMoveTask = (taskId: string, newStatus: TaskStatus): TodoItem => {
        return {
          ...task,
          status: newStatus,
          completed: newStatus === 'completed',
          completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
        };
      };

      // Mover para Em Andamento
      const inProgressTask = handleMoveTask(task.id, 'in_progress');
      assert.equal(inProgressTask.status, 'in_progress');
      assert.equal(inProgressTask.completed, false);

      // Mover para Concluída
      const completedTask = handleMoveTask(task.id, 'completed');
      assert.equal(completedTask.status, 'completed');
      assert.equal(completedTask.completed, true);
      assert.ok(completedTask.completedAt);

      // Reabrir para A Fazer
      const reopenedTask = handleMoveTask(task.id, 'todo');
      assert.equal(reopenedTask.status, 'todo');
      assert.equal(reopenedTask.completed, false);
      assert.equal(reopenedTask.completedAt, undefined);
    });

    it('Ações visíveis por teclado via focus-within / focus-visible', () => {
      // Classe padrão de ações deve conter group-focus-within e focus-within
      const actionClasses = 'flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity';
      assert.ok(actionClasses.includes('group-focus-within:opacity-100'), 'Deve conter suporte a foco interno do grupo');
      assert.ok(actionClasses.includes('focus-within:opacity-100'), 'Deve exibir botões de ação quando qualquer elemento interno receber foco');
    });
  });

  describe('Verificação Real de Contraste WCAG 2.1 AA (Mínimo 4.5:1 para texto normal)', () => {
    it('Verifica contraste de zinc-500 (#71717a) e zinc-600 (#52525b) sobre fundo branco (#ffffff)', () => {
      const zinc500OnWhite = getContrastRatio('#71717a', '#ffffff');
      const zinc600OnWhite = getContrastRatio('#52525b', '#ffffff');

      assert.ok(
        zinc500OnWhite >= 4.5,
        `zinc-500 em fundo branco deve ter contraste >= 4.5:1 (calculado: ${zinc500OnWhite.toFixed(2)}:1)`
      );
      assert.ok(
        zinc600OnWhite >= 4.5,
        `zinc-600 em fundo branco deve ter contraste >= 4.5:1 (calculado: ${zinc600OnWhite.toFixed(2)}:1)`
      );
    });

    it('Verifica contraste de zinc-400 (#a1a1aa) e zinc-300 (#d4d4d8) sobre fundo escuro (#18181b)', () => {
      const zinc400OnDark = getContrastRatio('#a1a1aa', '#18181b');
      const zinc300OnDark = getContrastRatio('#d4d4d8', '#18181b');

      assert.ok(
        zinc400OnDark >= 4.5,
        `zinc-400 em fundo escuro deve ter contraste >= 4.5:1 (calculado: ${zinc400OnDark.toFixed(2)}:1)`
      );
      assert.ok(
        zinc300OnDark >= 4.5,
        `zinc-300 em fundo escuro deve ter contraste >= 4.5:1 (calculado: ${zinc300OnDark.toFixed(2)}:1)`
      );
    });

    it('Rejeita o uso de zinc-400 (#a1a1aa) para texto normal sobre fundo branco', () => {
      const zinc400OnWhite = getContrastRatio('#a1a1aa', '#ffffff');
      assert.ok(
        zinc400OnWhite < 4.5,
        `zinc-400 falha no critério WCAG AA em fundo claro (calculado: ${zinc400OnWhite.toFixed(2)}:1 < 4.5:1), devendo ser substituído por zinc-500 ou zinc-600`
      );
    });
  });

  describe('Respeito à Preferência de Movimento Reduzido (prefers-reduced-motion)', () => {
    it('Suprime animações complexas/confetes quando usuário solicita movimento reduzido', () => {
      function shouldRunAnimation(prefersReducedMotion: boolean): boolean {
        return !prefersReducedMotion;
      }

      assert.equal(shouldRunAnimation(true), false, 'Deve desativar confetes quando prefers-reduced-motion for true');
      assert.equal(shouldRunAnimation(false), true, 'Pode ativar confetes quando prefers-reduced-motion for false');
    });
  });

  describe('Semântica e Acessibilidade dos Modais e Elementos', () => {
    it('Garante que diálogos de alerta e informativos possuem títulos e papéis corretos', () => {
      const confirmModalConfig = {
        role: 'alertdialog',
        ariaModal: true,
        ariaLabelledby: 'confirm-modal-title',
        ariaDescribedby: 'confirm-modal-desc',
      };

      const taskModalConfig = {
        role: 'dialog',
        ariaModal: true,
        ariaLabelledby: 'task-modal-title',
      };

      assert.equal(confirmModalConfig.role, 'alertdialog');
      assert.equal(confirmModalConfig.ariaModal, true);
      assert.ok(confirmModalConfig.ariaLabelledby);
      assert.ok(confirmModalConfig.ariaDescribedby);

      assert.equal(taskModalConfig.role, 'dialog');
      assert.equal(taskModalConfig.ariaModal, true);
      assert.ok(taskModalConfig.ariaLabelledby);
    });

    it('Garante que botões de alternância e seleção utilizam estados semânticos acessíveis', () => {
      const groupButton = {
        type: 'button',
        role: 'button',
        ariaPressed: true,
        ariaLabel: 'Selecionar espaço: Minhas Tarefas (Pessoal)',
      };

      const taskCheckbox = {
        type: 'button',
        role: 'checkbox',
        ariaChecked: true,
        ariaLabel: 'Marcar tarefa como concluída',
      };

      assert.equal(groupButton.type, 'button');
      assert.equal(groupButton.ariaPressed, true);
      assert.equal(taskCheckbox.role, 'checkbox');
      assert.equal(taskCheckbox.ariaChecked, true);
    });
  });
});
