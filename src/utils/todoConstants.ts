import { getLocalDateString } from './dateUtils';
import { Category, Priority } from '../types/todo';

export interface CategoryMeta {
  id: Category;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  work: {
    id: 'work',
    label: 'Trabalho',
    color: 'text-blue-500 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-200 dark:border-blue-800/60',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  },
  personal: {
    id: 'personal',
    label: 'Pessoal',
    color: 'text-purple-500 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/40',
    borderColor: 'border-purple-200 dark:border-purple-800/60',
    badgeBg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  },
  study: {
    id: 'study',
    label: 'Estudos',
    color: 'text-emerald-500 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800/60',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  health: {
    id: 'health',
    label: 'Saúde',
    color: 'text-rose-500 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-200 dark:border-rose-800/60',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  },
  finance: {
    id: 'finance',
    label: 'Finanças',
    color: 'text-amber-500 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800/60',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  other: {
    id: 'other',
    label: 'Outros',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-900/40',
    borderColor: 'border-slate-200 dark:border-slate-800/60',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  },
};

export interface PriorityMeta {
  id: Priority;
  label: string;
  weight: number;
  badgeClass: string;
  dotColor: string;
}

export const PRIORITIES: Record<Priority, PriorityMeta> = {
  urgent: {
    id: 'urgent',
    label: 'Urgente',
    weight: 4,
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dotColor: 'bg-rose-500',
  },
  high: {
    id: 'high',
    label: 'Alta',
    weight: 3,
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotColor: 'bg-amber-500',
  },
  medium: {
    id: 'medium',
    label: 'Média',
    weight: 2,
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dotColor: 'bg-blue-500',
  },
  low: {
    id: 'low',
    label: 'Baixa',
    weight: 1,
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
};

export const INITIAL_TODOS = [
  {
    id: 'demo-1',
    title: 'Finalizar o design do novo App de Tarefas 🚀',
    description: 'Ajustar as paletas de cores, microinterações, modo escuro e responsividade para dispositivos móveis.',
    completed: false,
    priority: 'urgent' as const,
    category: 'work' as const,
    dueDate: getLocalDateString(),
    dueTime: '18:00',
    pinned: true,
    subTasks: [
      { id: 'sub-1', title: 'Definir tokens de tema escuro e claro', completed: true },
      { id: 'sub-2', title: 'Adicionar efeito de confetti ao completar tarefas', completed: true },
      { id: 'sub-3', title: 'Garantir suporte a atalhos e subtarefas', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    title: 'Revisar orçamento mensal e investimentos 📊',
    description: 'Categorizar gastos do cartão de crédito e verificar alocação da reserva de emergência.',
    completed: false,
    priority: 'high' as const,
    category: 'finance' as const,
    dueDate: getLocalDateString(new Date(Date.now() + 86400000 * 2)),
    pinned: false,
    subTasks: [
      { id: 'sub-4', title: 'Exportar extrato bancário', completed: false },
      { id: 'sub-5', title: 'Atualizar planilha de controle', completed: false },
    ],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'demo-3',
    title: 'Treino de corrida e hidratação 🏃‍♂️',
    description: 'Completar 5km no parque e manter ingestão mínima de 2.5L de água no dia.',
    completed: true,
    priority: 'medium' as const,
    category: 'health' as const,
    dueDate: getLocalDateString(),
    pinned: false,
    subTasks: [],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: 'demo-4',
    title: 'Estudar arquitetura Next.js 16 e Server Actions 📚',
    description: 'Ler os guias práticos sobre caching e renderização avançada.',
    completed: false,
    priority: 'low' as const,
    category: 'study' as const,
    dueDate: getLocalDateString(new Date(Date.now() + 86400000 * 5)),
    pinned: false,
    subTasks: [
      { id: 'sub-6', title: 'Assistir aula sobre revalidação de dados', completed: false },
    ],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export interface AvatarPreset {
  id: string;
  emoji: string;
  label: string;
  bg: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'rocket', emoji: '🚀', label: 'Explorador', bg: 'from-blue-600 to-indigo-600' },
  { id: 'zap', emoji: '⚡', label: 'Ágil', bg: 'from-amber-500 to-orange-600' },
  { id: 'wizard', emoji: '🧙‍♂️', label: 'Foco Supremo', bg: 'from-purple-600 to-violet-700' },
  { id: 'owl', emoji: '🦉', label: 'Sábio', bg: 'from-emerald-600 to-teal-700' },
  { id: 'robot', emoji: '🤖', label: 'Produtivo', bg: 'from-cyan-600 to-blue-700' },
  { id: 'lion', emoji: '🦁', label: 'Líder', bg: 'from-yellow-500 to-amber-600' },
  { id: 'target', emoji: '🎯', label: 'Focado', bg: 'from-rose-600 to-red-600' },
  { id: 'star', emoji: '✨', label: 'Criativo', bg: 'from-fuchsia-600 to-pink-600' },
];
