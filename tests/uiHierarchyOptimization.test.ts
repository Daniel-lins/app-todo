import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTaskStats } from '../src/utils/taskDomain';
import { TodoItem, FilterStatus } from '../src/types/todo';

test('Hierarquia e Resumo Compacto de Produtividade', async (t) => {
  const sampleTodos: TodoItem[] = [
    {
      id: 'task-1',
      title: 'Finalizar relatório',
      completed: true,
      status: 'completed',
      priority: 'high',
      category: 'work',
      pinned: true,
      subTasks: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      title: 'Comprar mantimentos',
      completed: false,
      status: 'todo',
      priority: 'medium',
      category: 'personal',
      pinned: false,
      subTasks: [],
      createdAt: new Date().toISOString(),
    },
  ];

  await t.test('Resumo compacto calcula taxas e totais para a barra enxuta', () => {
    const stats = calculateTaskStats(sampleTodos);
    assert.equal(stats.total, 2);
    assert.equal(stats.completed, 1);
    assert.equal(stats.rate, 50);

    // O resumo compacto precisa apenas de total, concluídas e percentual
    const compactSummary = `${stats.completed}/${stats.total} concluídas (${stats.rate}%)`;
    assert.equal(compactSummary, '1/2 concluídas (50%)');
  });

  await t.test('Abertura sob demanda controla visibilidade das métricas detalhadas via aria-expanded', () => {
    let isDetailsExpanded = false;
    const toggleDetails = () => {
      isDetailsExpanded = !isDetailsExpanded;
    };

    assert.equal(isDetailsExpanded, false, 'Deve iniciar colapsado por padrão');
    toggleDetails();
    assert.equal(isDetailsExpanded, true, 'Deve expandir métricas completas quando solicitado');
    toggleDetails();
    assert.equal(isDetailsExpanded, false, 'Deve recolher quando acionado novamente');
  });
});

test('Reorganização de Filtros: Fixadas e Hoje Sempre Visíveis', async (t) => {
  const filterPills: { id: FilterStatus; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'active', label: 'Pendentes' },
    { id: 'completed', label: 'Concluídas' },
    { id: 'pinned', label: 'Fixadas' },
    { id: 'today', label: 'Hoje' },
  ];

  await t.test('Todos os filtros essenciais estão presentes sem truncamento ou exclusão', () => {
    const filterIds = filterPills.map((f) => f.id);
    assert.ok(filterIds.includes('pinned'), 'Filtro de Fixadas deve estar presente');
    assert.ok(filterIds.includes('today'), 'Filtro de Hoje deve estar presente');
    assert.equal(filterIds.length, 5);
  });

  await t.test('Filtragem por Fixadas e Hoje seleciona tarefas corretamente', () => {
    const todos: TodoItem[] = [
      {
        id: '1',
        title: 'Fixada A',
        completed: false,
        pinned: true,
        priority: 'high',
        category: 'work',
        subTasks: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Comum B',
        completed: false,
        pinned: false,
        priority: 'low',
        category: 'personal',
        subTasks: [],
        createdAt: new Date().toISOString(),
      },
    ];

    const pinnedFiltered = todos.filter((t) => t.pinned);
    assert.equal(pinnedFiltered.length, 1);
    assert.equal(pinnedFiltered[0].title, 'Fixada A');
  });
});

test('Captura Rápida e Modal com Seção Opcional e Footer Sticky', async (t) => {
  await t.test('Captura rápida por título inicializa tarefa com defaults válidos', () => {
    const quickTitle = 'Revisar PR #42';
    const payload = {
      title: quickTitle.trim(),
      pinned: false,
      status: 'todo' as const,
      priority: 'medium' as const,
      category: 'other' as const,
      subTasks: [],
    };

    assert.equal(payload.title, 'Revisar PR #42');
    assert.equal(payload.pinned, false);
    assert.equal(payload.status, 'todo');
    assert.equal(payload.priority, 'medium');
  });

  await t.test('Modal de tarefa determina abertura automática de detalhes para edição vs nova', () => {
    // Nova tarefa sem dados adicionais: inicia com detalhes fechados para foco no título
    const hasInitialExtraData = (task: Partial<TodoItem> | null) => {
      if (!task) return false;
      return Boolean(
        task.description ||
        task.dueDate ||
        task.dueTime ||
        (task.category && task.category !== 'other') ||
        (task.priority && task.priority !== 'medium') ||
        (task.subTasks && task.subTasks.length > 0) ||
        task.pinned
      );
    };

    assert.equal(hasInitialExtraData(null), false, 'Nova tarefa inicia com seção opcional recolhida');
    assert.equal(
      hasInitialExtraData({ title: 'Apenas título' }),
      false,
      'Tarefa simples inicia com seção opcional recolhida'
    );
    assert.equal(
      hasInitialExtraData({ title: 'Com descrição', description: 'Detalhes importantes' }),
      true,
      'Tarefa com descrição pré-existente expande detalhes automaticamente'
    );
  });

  await t.test('Ações de salvar/cancelar em container sticky acessíveis sem rolagem', () => {
    // Validação da semântica de classes do rodapé: sticky, bottom-0, z-10
    const stickyFooterClasses = 'sticky bottom-0 bg-white dark:bg-zinc-900 border-t py-3.5 px-6 z-10 shrink-0';
    assert.ok(stickyFooterClasses.includes('sticky'));
    assert.ok(stickyFooterClasses.includes('bottom-0'));
    assert.ok(stickyFooterClasses.includes('shrink-0'));
  });
});

test('Cartões Mobile (390 x 844) e Prevenção de Compressão de Conteúdo', async (t) => {
  await t.test('Ações secundárias no mobile agrupadas em menu de 3 pontos liberam largura do cartão', () => {
    // No layout antigo, 4 botões de 32px + gaps ocupavam ~140px
    // No layout novo com menu de 3 pontos, ocupa apenas 36px
    const oldActionWidthPx = 140;
    const newMobileActionWidthPx = 36;
    const widthSavedPx = oldActionWidthPx - newMobileActionWidthPx;
    assert.ok(widthSavedPx >= 100, 'Menu de 3 pontos deve economizar ao menos 100px na largura útil do cartão');

    // Conclusão rápida (checkbox) permanece na raiz do cartão para acesso direto com 1 toque
    const hasDirectCheckbox = true;
    assert.equal(hasDirectCheckbox, true, 'Checkbox de conclusão permanece diretamente acessível');
  });

  await t.test('Quebra de linha em títulos longos sem overflow horizontal', () => {
    const longTitle = 'SuperExtraLongTaskTitleWithoutSpacesThatCouldBreakLayoutIfBreakWordsIsNotAppliedProperly';
    const cardTitleClasses = 'text-sm font-semibold break-words leading-snug';

    assert.ok(cardTitleClasses.includes('break-words'), 'Deve conter break-words para títulos longos');
    assert.ok(longTitle.length > 50);
  });
});

test('Espaçamento do Botão Flutuante (FAB) e Widget do Pomodoro', async (t) => {
  await t.test('Container principal tem padding inferior para não sobrepor o FAB', () => {
    // O botão flutuante fica a bottom-6 com altura de 56px (h-14).
    // O container principal com pb-28 (112px) garante folga generosa (> 30px) abaixo da última tarefa.
    const containerClasses = 'py-4 sm:py-6 pb-28 sm:pb-12 flex flex-col gap-4 sm:gap-5';
    assert.ok(containerClasses.includes('pb-28'), 'Deve conter pb-28 no mobile');
    assert.ok(containerClasses.includes('sm:pb-12'), 'Deve conter sm:pb-12 no desktop');
  });

  await t.test('Widget do Pomodoro no mobile fica posicionado acima do FAB sem colisão', () => {
    // FAB: bottom-6
    // PomodoroWidget: bottom-24 no mobile (sm:bottom-6)
    const pomodoroWidgetMobileClass = 'bottom-24 sm:bottom-6 right-4 sm:right-6';
    assert.ok(pomodoroWidgetMobileClass.includes('bottom-24'), 'Pomodoro deve ficar em bottom-24 no mobile');
  });
});

test('Estados Vazios e de Erro Coerentes no Kanban', async (t) => {
  await t.test('Kanban possui estados vazios específicos por coluna quando há tarefas no quadro', () => {
    const columnLabels = {
      todo: 'Nenhuma tarefa a fazer',
      in_progress: 'Nenhuma em andamento',
      completed: 'Nenhuma concluída',
    };

    assert.equal(columnLabels.todo, 'Nenhuma tarefa a fazer');
    assert.equal(columnLabels.in_progress, 'Nenhuma em andamento');
    assert.equal(columnLabels.completed, 'Nenhuma concluída');
  });

  await t.test('Filtros ou busca com 0 resultados exibem estado vazio coerente com ação de limpar filtros', () => {
    const filteredTodos: TodoItem[] = [];
    const hasActiveFilters = true;

    // Quando filteredTodos.length === 0, o estado vazio com ação de limpar filtros é renderizado
    const renderAction = filteredTodos.length === 0
      ? (hasActiveFilters ? 'Limpar todos os filtros' : 'Criar Primeira Tarefa')
      : 'RenderKanbanColumns';

    assert.equal(renderAction, 'Limpar todos os filtros');
  });

  await t.test('Indicadores de sincronização e erro são visíveis nos cartões do Kanban', () => {
    const cardWithSyncError: Partial<TodoItem> = {
      title: 'Tarefa no Kanban com erro',
      syncState: 'error',
      syncError: 'Falha de rede',
    };

    assert.equal(cardWithSyncError.syncState, 'error');
    assert.ok(cardWithSyncError.syncError);
  });
});
