/**
 * @file rpgService.ts
 * @description Motor do Sistema de RPG e Gamificação de Áreas da Vida do AppToDo.
 * Transforma a realização de tarefas e ciclos Pomodoro em pontos de experiência (XP),
 * evolução de Nível Geral do Personagem e progressão de Atributos/Habilidades por área.
 */

import { TodoItem, Category, Priority, RpgAttribute, RpgBadge, RpgStats } from '../types/todo';

/**
 * Tabela de XP base concedida de acordo com a prioridade da tarefa.
 */
export const XP_BY_PRIORITY: Record<Priority, number> = {
  low: 30,
  medium: 30,
  high: 30,
  urgent: 30,
};

/**
 * Bônus de XP concedido por cada subtarefa concluída na tarefa.
 */
export const XP_PER_SUBTASK = 10;

/**
 * Bônus de XP concedido por cada ciclo de foco Pomodoro completado na tarefa.
 */
export const XP_PER_POMODORO = 20;

/**
 * Mapeamento das 6 categorias de tarefas para Atributos de RPG / Áreas da Vida.
 */
export const RPG_ATTRIBUTES_CONFIG: Record<
  Category,
  {
    name: string;
    areaName: string;
    description: string;
    iconName: string;
    color: string;
    badgeBg: string;
  }
> = {
  work: {
    name: 'Execução & Foco',
    areaName: 'Trabalho',
    description: 'Capacidade de entrega, disciplina profissional e maestria de carreira.',
    iconName: 'Briefcase',
    color: '#f59e0b',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  study: {
    name: 'Intelecto & Sabedoria',
    areaName: 'Estudo',
    description: 'Absorção de conhecimento, leitura crítica e expansão mental contínua.',
    iconName: 'BookOpen',
    color: '#3b82f6',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  health: {
    name: 'Vitalidade & Energia',
    areaName: 'Saúde',
    description: 'Vigor corporal, atividade física, nutrição equilibrada e qualidade de sono.',
    iconName: 'Heart',
    color: '#10b981',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  finance: {
    name: 'Prosperidade & Gestão',
    areaName: 'Finanças',
    description: 'Controle orçamentário, inteligência financeira e disciplina de patrimônio.',
    iconName: 'DollarSign',
    color: '#eab308',
    badgeBg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
  personal: {
    name: 'Equilíbrio & Espírito',
    areaName: 'Pessoal',
    description: 'Relações afetivas, lazer restaurador, serenidade mental e autoconhecimento.',
    iconName: 'Sparkles',
    color: '#a855f7',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  other: {
    name: 'Versatilidade & Adaptação',
    areaName: 'Outros',
    description: 'Flexibilidade e capacidade de resolver demandas imprevistas do dia a dia.',
    iconName: 'Shield',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  },
};

/**
 * Calcula o XP total individual que uma tarefa concede ao ser completada.
 */
export function calculateTaskXp(task: TodoItem): {
  base: number;
  subtasks: number;
  pomodoros: number;
  total: number;
} {
  const base = XP_BY_PRIORITY[task.priority] ?? XP_BY_PRIORITY.medium;
  const completedSubsCount = Array.isArray(task.subTasks)
    ? task.subTasks.filter((s) => s.completed).length
    : 0;
  const subtasks = completedSubsCount * XP_PER_SUBTASK;
  const pomodoros = (task.pomodoros || 0) * XP_PER_POMODORO;
  const total = base + subtasks + pomodoros;

  return { base, subtasks, pomodoros, total };
}

/**
 * Calcula a progressão do Nível Geral do Personagem a partir do XP total acumulado.
 * 
 * Regra da Curva:
 * Cada nível L requer (100 * L) de XP para passar para o nível L + 1.
 * O XP total acumulado para alcançar o início do nível L é 50 * (L - 1) * L.
 */
export function calculateLevelFromXp(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
} {
  const safeXp = Math.max(0, Math.floor(totalXp || 0));

  // Fórmula inversa quadrática: 50 * L^2 - 50 * L - XP = 0
  // L = (50 + sqrt(2500 + 4 * 50 * XP)) / 100
  // L = (50 + sqrt(2500 + 200 * XP)) / 100
  const level = Math.max(1, Math.floor((50 + Math.sqrt(2500 + 200 * safeXp)) / 100));

  const xpAtCurrentLevelStart = 50 * (level - 1) * level;
  const nextLevelXp = 100 * level;
  const currentLevelXp = safeXp - xpAtCurrentLevelStart;
  const progressPercent = Math.min(100, Math.max(0, Math.floor((currentLevelXp / nextLevelXp) * 100)));

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
  };
}

/**
 * Calcula a progressão de um Atributo (Habilidade de Vida) específico.
 * 
 * Regra da Curva de Atributo:
 * Cada nível L do atributo requer (50 * L) de XP.
 * XP total no início do nível L é 25 * (L - 1) * L.
 */
export function calculateAttributeLevel(attributeXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
} {
  const safeXp = Math.max(0, Math.floor(attributeXp || 0));

  // 25 * L^2 - 25 * L - XP = 0 => L = (25 + sqrt(625 + 100 * XP)) / 50
  const level = Math.max(1, Math.floor((25 + Math.sqrt(625 + 100 * safeXp)) / 50));

  const xpAtCurrentLevelStart = 25 * (level - 1) * level;
  const nextLevelXp = 50 * level;
  const currentLevelXp = safeXp - xpAtCurrentLevelStart;
  const progressPercent = Math.min(100, Math.max(0, Math.floor((currentLevelXp / nextLevelXp) * 100)));

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
  };
}

/**
 * Retorna o título honorífico do personagem baseado no Nível Geral.
 */
export function getTitleForLevel(level: number): string {
  if (level >= 50) return 'Arquimago da Vida';
  if (level >= 40) return 'Lorde da Disciplina';
  if (level >= 30) return 'Comandante de Alta Performance';
  if (level >= 20) return 'Mestre da Execução';
  if (level >= 15) return 'Estrategista Ágil';
  if (level >= 10) return 'Guardião da Rotina';
  if (level >= 5) return 'Aventureiro Focado';
  return 'Aprendiz da Produtividade';
}

/**
 * Retorna o resumo do ganho de recompensa ao concluir uma tarefa específica.
 */
export function getTaskCompletionReward(task: TodoItem): {
  xp: number;
  attributeName: string;
  areaName: string;
  category: Category;
} {
  const { total } = calculateTaskXp(task);
  const meta = RPG_ATTRIBUTES_CONFIG[task.category] || RPG_ATTRIBUTES_CONFIG.other;

  return {
    xp: total,
    attributeName: meta.name,
    areaName: meta.areaName,
    category: task.category,
  };
}

/**
 * Avalia as Conquistas / Badges com base no estado das tarefas e minutos de foco.
 */
export function evaluateBadges(todos: TodoItem[]): RpgBadge[] {
  return todos.filter(task => task.kind === 'mission').map(task => {
    const current = task.subTasks.filter(step => step.completed).length;
    const total = task.subTasks.length;
    const unlocked = task.completed && total > 0 && current === total;
    return {
      id: `mission:${task.id}`, title: task.title, category: task.category,
      description: unlocked ? 'Missão grande concluída.' : 'Complete as etapas para conquistar este objetivo.',
      icon: 'Award', unlocked, unlockedAt: unlocked ? task.completedAt : undefined,
      progress: { current, total },
    };
  }).sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || (b.unlockedAt || '').localeCompare(a.unlockedAt || '') || a.title.localeCompare(b.title));
}

/**
 * Calcula todas as estatísticas consolidadas de RPG de forma pura e determinística.
 * Pode ser chamado diretamente passando as tarefas locais e minutos de foco.
 */
export function calculateRpgStats(
  todos: TodoItem[],
  focusMinutes: number = 0
): RpgStats {
  const completedTasks = (todos || []).filter((t) => t.completed);
  const focusCycles = (todos || []).reduce((sum, t) => sum + Math.max(0, t.pomodoros || 0), 0);
  const scopedFocusMinutes = Math.max(focusMinutes, focusCycles * 25);

  // Inicializa acumuladores de XP por categoria
  const categoryXpMap: Record<Category, number> = {
    work: 0,
    study: 0,
    health: 0,
    finance: 0,
    personal: 0,
    other: 0,
  };

  let totalXp = 0;

  for (const task of completedTasks) {
    const { total } = calculateTaskXp(task);
    totalXp += total;

    const cat = task.category && categoryXpMap[task.category] !== undefined ? task.category : 'other';
    categoryXpMap[cat] += total;
  }

  // Progresso Geral
  const levelProgress = calculateLevelFromXp(totalXp);
  const title = getTitleForLevel(levelProgress.level);

  // Progresso por Atributo
  const categories: Category[] = ['work', 'study', 'health', 'finance', 'personal', 'other'];
  const attributes = {} as Record<Category, RpgAttribute>;

  for (const cat of categories) {
    const config = RPG_ATTRIBUTES_CONFIG[cat];
    const catXp = categoryXpMap[cat];
    const attrLevelProgress = calculateAttributeLevel(catXp);

    attributes[cat] = {
      id: cat,
      name: config.name,
      areaName: config.areaName,
      description: config.description,
      iconName: config.iconName,
      color: config.color,
      badgeBg: config.badgeBg,
      xp: catXp,
      level: attrLevelProgress.level,
      currentLevelXp: attrLevelProgress.currentLevelXp,
      nextLevelXp: attrLevelProgress.nextLevelXp,
      progressPercent: attrLevelProgress.progressPercent,
    };
  }

  const badges = evaluateBadges(todos || []);

  return {
    totalXp,
    level: levelProgress.level,
    currentLevelXp: levelProgress.currentLevelXp,
    nextLevelXp: levelProgress.nextLevelXp,
    progressPercent: levelProgress.progressPercent,
    title,
    attributes,
    badges,
    tasksCompletedCount: completedTasks.length,
    pomodoroFocusMinutes: scopedFocusMinutes,
  };
}
