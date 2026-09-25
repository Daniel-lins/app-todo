/**
 * Serviço de validação, importação e exportação de backups do AppToDo.
 * Implementa formato versionado, validação exaustiva de todos os itens e subtarefas,
 * limites de segurança, detecção de conflitos e isolamento de dados.
 */

import { TodoItem, Priority, Category, TaskStatus, SubTask } from '../types/todo';

export const CURRENT_BACKUP_VERSION = 2;
export const MAX_BACKUP_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_TASKS_PER_BACKUP = 1000;
export const MAX_SUBTASKS_PER_TASK = 50;

export const VALID_PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
export const VALID_CATEGORIES: Category[] = ['work', 'personal', 'study', 'health', 'finance', 'other'];
export const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'completed'];

export interface BackupFileV2 {
  version: 2;
  app: 'AppToDo';
  exportedAt: string;
  spaceName?: string;
  tasksCount: number;
  todos: TodoItem[];
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  todos: TodoItem[];
  version: 1 | 2;
  totalTasks: number;
  totalSubTasks: number;
  conflictsWithExisting: number;
  duplicateIdsFound: number;
}

/**
 * Gera os dados de exportação em formato versionado (V2),
 * omitindo estritamente credenciais, tokens ou dados sensíveis de conta.
 */
export function generateBackupData(todos: TodoItem[], spaceName?: string): string {
  // Limpa campos internos sensíveis se existirem e preserva apenas dados de domínio das tarefas
  const cleanTodos: TodoItem[] = todos.map((t, idx) => ({
    id: t.id,
    title: t.title.trim(),
    description: t.description ? t.description.trim() : undefined,
    completed: !!t.completed,
    status: t.status || (t.completed ? 'completed' : 'todo'),
    priority: VALID_PRIORITIES.includes(t.priority) ? t.priority : 'medium',
    category: VALID_CATEGORIES.includes(t.category) ? t.category : 'other',
    dueDate: t.dueDate || undefined,
    dueTime: t.dueTime || undefined,
    pinned: !!t.pinned,
    pomodoros: typeof t.pomodoros === 'number' ? t.pomodoros : 0,
    order: typeof t.order === 'number' ? t.order : idx,
    createdAt: t.createdAt || new Date().toISOString(),
    completedAt: t.completedAt || undefined,
    subTasks: (t.subTasks || []).map((st) => ({
      id: st.id,
      title: st.title.trim(),
      completed: !!st.completed,
    })),
    // groupId do espaço original apenas como metadado informativo
    groupId: t.groupId || undefined,
  }));

  const backupPayload: BackupFileV2 = {
    version: CURRENT_BACKUP_VERSION,
    app: 'AppToDo',
    exportedAt: new Date().toISOString(),
    spaceName: spaceName || 'Espaço Pessoal',
    tasksCount: cleanTodos.length,
    todos: cleanTodos,
  };

  return JSON.stringify(backupPayload, null, 2);
}

/**
 * Valida minuciosamente todo o conteúdo do arquivo de backup:
 * - Valida cada tarefa individualmente (não apenas a primeira)
 * - Valida todas as subtarefas de cada tarefa
 * - Valida tipos, enums, limites de tamanho e integridade de datas
 * - Trata duplicatas de IDs e conflitos com tarefas existentes
 */
export function validateAndParseBackupFile(
  rawContent: string,
  existingTodos: TodoItem[] = []
): BackupValidationResult {
  // 1. Limite de tamanho de arquivo
  if (!rawContent || typeof rawContent !== 'string') {
    return {
      valid: false,
      error: 'O arquivo está vazio ou em formato ilegível.',
      todos: [],
      version: 1,
      totalTasks: 0,
      totalSubTasks: 0,
      conflictsWithExisting: 0,
      duplicateIdsFound: 0,
    };
  }

  if (rawContent.length > MAX_BACKUP_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `O arquivo excede o limite máximo permitido de 5 MB.`,
      todos: [],
      version: 1,
      totalTasks: 0,
      totalSubTasks: 0,
      conflictsWithExisting: 0,
      duplicateIdsFound: 0,
    };
  }

  // 2. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return {
      valid: false,
      error: 'O arquivo não contém um formato JSON válido.',
      todos: [],
      version: 1,
      totalTasks: 0,
      totalSubTasks: 0,
      conflictsWithExisting: 0,
      duplicateIdsFound: 0,
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      valid: false,
      error: 'Estrutura de dados do backup inválida.',
      todos: [],
      version: 1,
      totalTasks: 0,
      totalSubTasks: 0,
      conflictsWithExisting: 0,
      duplicateIdsFound: 0,
    };
  }

  // 3. Identifica a versão do backup
  let version: 1 | 2 = 1;
  let rawList: unknown[] = [];

  if (Array.isArray(parsed)) {
    // Formato legado V1 (array puro de tarefas)
    version = 1;
    rawList = parsed;
  } else if ('todos' in parsed && Array.isArray((parsed as { todos: unknown }).todos)) {
    // Formato versionado V2
    const v2Obj = parsed as { version?: unknown; todos: unknown[] };
    version = v2Obj.version === 2 ? 2 : 1;
    rawList = v2Obj.todos;
  } else {
    return {
      valid: false,
      error: 'O backup deve conter uma lista de tarefas (campo "todos" ou array raiz).',
      todos: [],
      version: 1,
      totalTasks: 0,
      totalSubTasks: 0,
      conflictsWithExisting: 0,
      duplicateIdsFound: 0,
    };
  }

  // 4. Limite de quantidade de tarefas
  if (rawList.length > MAX_TASKS_PER_BACKUP) {
    return {
      valid: false,
      error: `O arquivo contém ${rawList.length} tarefas, excedendo o limite de ${MAX_TASKS_PER_BACKUP} tarefas.`,
      todos: [],
      version,
      totalTasks: rawList.length,
      totalSubTasks: 0,
      conflictsWithExisting: 0,
      duplicateIdsFound: 0,
    };
  }

  // 5. Validação de TODOS os itens e subtarefas
  const validatedTodos: TodoItem[] = [];
  const seenIdsInFile = new Set<string>();
  let duplicateIdsFound = 0;
  let totalSubTasks = 0;

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    const itemIndex = i + 1;

    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return {
        valid: false,
        error: `A tarefa #${itemIndex} não é um objeto válido.`,
        todos: [],
        version,
        totalTasks: 0,
        totalSubTasks: 0,
        conflictsWithExisting: 0,
        duplicateIdsFound: 0,
      };
    }

    const obj = item as Record<string, unknown>;

    // Validação de Título (obrigatório, string, não vazia)
    if (!obj.title || typeof obj.title !== 'string' || !obj.title.trim()) {
      return {
        valid: false,
        error: `A tarefa #${itemIndex} possui título inválido ou vazio.`,
        todos: [],
        version,
        totalTasks: 0,
        totalSubTasks: 0,
        conflictsWithExisting: 0,
        duplicateIdsFound: 0,
      };
    }

    // Validação de ID e tratamento de duplicatas no próprio arquivo
    let id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `import-${Date.now()}-${i}`;
    if (seenIdsInFile.has(id)) {
      duplicateIdsFound++;
      id = `${id}-dup-${Math.random().toString(36).substring(2, 6)}`;
    }
    seenIdsInFile.add(id);

    // Validação de Prioridade
    let priority: Priority = 'medium';
    if (obj.priority && typeof obj.priority === 'string') {
      if (VALID_PRIORITIES.includes(obj.priority as Priority)) {
        priority = obj.priority as Priority;
      } else {
        return {
          valid: false,
          error: `A tarefa #${itemIndex} ("${obj.title}") possui prioridade inválida: "${obj.priority}".`,
          todos: [],
          version,
          totalTasks: 0,
          totalSubTasks: 0,
          conflictsWithExisting: 0,
          duplicateIdsFound: 0,
        };
      }
    }

    // Validação de Categoria
    let category: Category = 'other';
    if (obj.category && typeof obj.category === 'string') {
      if (VALID_CATEGORIES.includes(obj.category as Category)) {
        category = obj.category as Category;
      } else {
        return {
          valid: false,
          error: `A tarefa #${itemIndex} ("${obj.title}") possui categoria inválida: "${obj.category}".`,
          todos: [],
          version,
          totalTasks: 0,
          totalSubTasks: 0,
          conflictsWithExisting: 0,
          duplicateIdsFound: 0,
        };
      }
    }

    // Validação de Status e Conclusão
    const completed = !!obj.completed;
    let status: TaskStatus = completed ? 'completed' : 'todo';
    if (obj.status && typeof obj.status === 'string') {
      if (VALID_STATUSES.includes(obj.status as TaskStatus)) {
        status = obj.status as TaskStatus;
      } else {
        return {
          valid: false,
          error: `A tarefa #${itemIndex} ("${obj.title}") possui status inválido: "${obj.status}".`,
          todos: [],
          version,
          totalTasks: 0,
          totalSubTasks: 0,
          conflictsWithExisting: 0,
          duplicateIdsFound: 0,
        };
      }
    }

    // Garante coerência entre status e completed
    if (status === 'completed' && !completed) {
      status = 'todo';
    } else if (completed && status !== 'completed') {
      status = 'completed';
    }

    // Validação de Data de Vencimento
    let dueDate: string | undefined = undefined;
    if (obj.dueDate && typeof obj.dueDate === 'string' && obj.dueDate.trim()) {
      const cleanDate = obj.dueDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        return {
          valid: false,
          error: `A tarefa #${itemIndex} ("${obj.title}") possui formato de data de vencimento inválido (esperado YYYY-MM-DD): "${cleanDate}".`,
          todos: [],
          version,
          totalTasks: 0,
          totalSubTasks: 0,
          conflictsWithExisting: 0,
          duplicateIdsFound: 0,
        };
      }
      dueDate = cleanDate;
    }

    // Validação de Horário de Vencimento
    let dueTime: string | undefined = undefined;
    if (obj.dueTime && typeof obj.dueTime === 'string' && obj.dueTime.trim()) {
      const cleanTime = obj.dueTime.trim();
      if (!/^\d{2}:\d{2}$/.test(cleanTime)) {
        return {
          valid: false,
          error: `A tarefa #${itemIndex} ("${obj.title}") possui formato de horário inválido (esperado HH:MM): "${cleanTime}".`,
          todos: [],
          version,
          totalTasks: 0,
          totalSubTasks: 0,
          conflictsWithExisting: 0,
          duplicateIdsFound: 0,
        };
      }
      dueTime = cleanTime;
    }

    // Validação de Subtarefas
    const subTasksList: SubTask[] = [];
    if ('subTasks' in obj && obj.subTasks !== null && obj.subTasks !== undefined) {
      if (!Array.isArray(obj.subTasks)) {
        return {
          valid: false,
          error: `A tarefa #${itemIndex} ("${obj.title}") possui subtarefas em formato inválido (não é array).`,
          todos: [],
          version,
          totalTasks: 0,
          totalSubTasks: 0,
          conflictsWithExisting: 0,
          duplicateIdsFound: 0,
        };
      }

      if (obj.subTasks.length > MAX_SUBTASKS_PER_TASK) {
        return {
          valid: false,
          error: `A tarefa #${itemIndex} ("${obj.title}") excede o limite de ${MAX_SUBTASKS_PER_TASK} subtarefas.`,
          todos: [],
          version,
          totalTasks: 0,
          totalSubTasks: 0,
          conflictsWithExisting: 0,
          duplicateIdsFound: 0,
        };
      }

      for (let s = 0; s < obj.subTasks.length; s++) {
        const sub = obj.subTasks[s];
        const subIndex = s + 1;
        if (typeof sub !== 'object' || sub === null || Array.isArray(sub)) {
          return {
            valid: false,
            error: `A subtarefa #${subIndex} da tarefa #${itemIndex} é inválida.`,
            todos: [],
            version,
            totalTasks: 0,
            totalSubTasks: 0,
            conflictsWithExisting: 0,
            duplicateIdsFound: 0,
          };
        }
        const subObj = sub as Record<string, unknown>;
        if (!subObj.title || typeof subObj.title !== 'string' || !subObj.title.trim()) {
          return {
            valid: false,
            error: `A subtarefa #${subIndex} da tarefa #${itemIndex} possui título vazio.`,
            todos: [],
            version,
            totalTasks: 0,
            totalSubTasks: 0,
            conflictsWithExisting: 0,
            duplicateIdsFound: 0,
          };
        }

        subTasksList.push({
          id: typeof subObj.id === 'string' && subObj.id.trim() ? subObj.id.trim() : `sub-${Date.now()}-${i}-${s}`,
          title: subObj.title.trim(),
          completed: !!subObj.completed,
        });
        totalSubTasks++;
      }
    }

    validatedTodos.push({
      id,
      title: obj.title.trim(),
      description: typeof obj.description === 'string' && obj.description.trim() ? obj.description.trim() : undefined,
      completed,
      status,
      priority,
      category,
      dueDate,
      dueTime,
      pinned: !!obj.pinned,
      pomodoros: typeof obj.pomodoros === 'number' && obj.pomodoros >= 0 ? obj.pomodoros : 0,
      order: typeof obj.order === 'number' ? obj.order : i,
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
      completedAt: completed && typeof obj.completedAt === 'string' ? obj.completedAt : undefined,
      subTasks: subTasksList,
    });
  }

  // 6. Contagem de conflitos com tarefas existentes no espaço
  const existingIdSet = new Set(existingTodos.map((t) => t.id));
  const conflictsWithExisting = validatedTodos.filter((t) => existingIdSet.has(t.id)).length;

  return {
    valid: true,
    todos: validatedTodos,
    version,
    totalTasks: validatedTodos.length,
    totalSubTasks,
    conflictsWithExisting,
    duplicateIdsFound,
  };
}

/**
 * Mescla ou substitui as tarefas importadas aplicando:
 * - Atribuição estrita do groupId do espaço de destino (isolamento absoluto)
 * - Tratamento de IDs repetidos: no modo 'merge', tarefas conflitantes recebem novos IDs únicos
 *   para garantir que tarefas existentes nunca sejam sobrescritas nem perdidas
 */
export function resolveImportTodos(
  existingTodos: TodoItem[],
  importedTodos: TodoItem[],
  mode: 'replace' | 'merge',
  targetGroupId?: string | null
): TodoItem[] {
  const targetGroup = targetGroupId || undefined;

  // Sanitiza atribuindo o groupId correto
  // Import creates copies: IDs from another account/space must never update its rows.
  const preparedImported = importedTodos.map((t) => ({
    ...t, id: crypto.randomUUID(), groupId: targetGroup,
    subTasks: t.subTasks.map(st => ({ ...st, id: crypto.randomUUID() })),
    updatedAt: new Date().toISOString(),
  }));

  return mode === 'replace' ? preparedImported : [...existingTodos, ...preparedImported];
}
