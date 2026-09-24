import { TodoItem } from '../types/todo';
import { INITIAL_TODOS } from './todoConstants';
import { resolveImportTodos } from './backupService';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const LEGACY_STORAGE_KEY = 'apptodo_tasks_v1';
export const LEGACY_BACKUP_KEY = 'apptodo_tasks_v1_backup';
export const GUEST_STORAGE_KEY = 'apptodo_tasks_guest';

/**
 * Retorna a chave isolada de armazenamento local dependendo do contexto:
 * - Visitante: 'apptodo_tasks_guest'
 * - Conta (Pessoal): 'apptodo_tasks_user_<userId>_personal'
 * - Conta (Grupo): 'apptodo_tasks_user_<userId>_group_<groupId>'
 */
export function getStorageKey(
  userId?: string | null,
  groupId?: string | null
): string {
  if (!userId) {
    return GUEST_STORAGE_KEY;
  }
  if (groupId) {
    return `apptodo_tasks_user_${userId}_group_${groupId}`;
  }
  return `apptodo_tasks_user_${userId}_personal`;
}

/**
 * Retorna o identificador de contexto único para controle de race conditions e troca de abas.
 */
export function getContextId(
  userId?: string | null,
  groupId?: string | null
): string {
  if (!userId) {
    return 'guest';
  }
  if (groupId) {
    return `user:${userId}:group:${groupId}`;
  }
  return `user:${userId}:personal`;
}

/**
 * Identifica se a lista contém estritamente o conteúdo de demonstração original (INITIAL_TODOS).
 * Compara por conteúdo e IDs, e não por referência de objeto em memória.
 */
export function isOnlyDemoTasks(todos: unknown): boolean {
  if (!Array.isArray(todos) || todos.length !== INITIAL_TODOS.length) {
    return false;
  }
  const demoMap = new Map(INITIAL_TODOS.map((d) => [d.id, d.title]));
  return todos.every(
    (t) =>
      typeof t === 'object' &&
      t !== null &&
      'id' in t &&
      'title' in t &&
      demoMap.has((t as { id: string }).id) &&
      demoMap.get((t as { id: string }).id) === (t as { title: string }).title
  );
}

function getSafeStorage(customStorage?: StorageLike): StorageLike | null {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Migra o armazenamento antigo ('apptodo_tasks_v1') para o novo formato isolado ('apptodo_tasks_guest')
 * preservando SEMPRE uma cópia de backup ('apptodo_tasks_v1_backup').
 */
export function migrateLegacyStorage(customStorage?: StorageLike): TodoItem[] | null {
  const storage = getSafeStorage(customStorage);
  if (!storage) return null;

  try {
    const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return null;

    // Preserva cópia de segurança se ainda não existir
    if (!storage.getItem(LEGACY_BACKUP_KEY)) {
      storage.setItem(LEGACY_BACKUP_KEY, legacyRaw);
    }

    const parsed = JSON.parse(legacyRaw);
    if (Array.isArray(parsed)) {
      // Se a chave de visitante ainda não estiver definida, popula com os dados legados
      if (storage.getItem(GUEST_STORAGE_KEY) === null) {
        storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed as TodoItem[];
    }
  } catch (err) {
    console.error('Erro ao migrar armazenamento antigo:', err);
  }
  return null;
}

/**
 * Carrega tarefas do contexto especificado com suporte completo a listas vazias persistentes.
 * - Se a chave nunca foi inicializada (getItem === null):
 *   - Visitante: inicializa com INITIAL_TODOS e salva.
 *   - Conta: inicializa vazia ([]).
 * - Se a chave já existe (getItem !== null):
 *   - Retorna os dados gravados, inclusive se for [] (lista vazia intencional).
 */
export function loadContextTodos(
  userId?: string | null,
  groupId?: string | null,
  customStorage?: StorageLike
): { todos: TodoItem[]; isFirstAccess: boolean } {
  const storage = getSafeStorage(customStorage);
  if (!storage) {
    return {
      todos: !userId && !groupId ? INITIAL_TODOS : [],
      isFirstAccess: true,
    };
  }

  // Verifica migração de legado no primeiro acesso de visitante
  if (!userId && !groupId) {
    migrateLegacyStorage(storage);
  }

  const key = getStorageKey(userId, groupId);
  const raw = storage.getItem(key);

  // Caso 1: Primeiro acesso a este espaço
  if (raw === null) {
    if (!userId && !groupId) {
      // Visitante novo: salva e entrega INITIAL_TODOS
      storage.setItem(key, JSON.stringify(INITIAL_TODOS));
      return { todos: INITIAL_TODOS, isFirstAccess: true };
    }
    // Conta ou grupo sem cache local: retorna vazio
    return { todos: [], isFirstAccess: true };
  }

  // Caso 2: Espaço já inicializado (inclusive se estiver vazio!)
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Mantém a lista exatamente como está, mesmo que length === 0
      return { todos: parsed as TodoItem[], isFirstAccess: false };
    }
  } catch (err) {
    console.error(`Erro ao analisar cache para chave ${key}:`, err);
  }

  return { todos: [], isFirstAccess: false };
}

/**
 * Salva as tarefas do contexto ativo no armazenamento local isolado.
 */
export function saveContextTodos(
  userId: string | null | undefined,
  groupId: string | null | undefined,
  todos: TodoItem[],
  customStorage?: StorageLike
): void {
  const storage = getSafeStorage(customStorage);
  if (!storage) return;

  const key = getStorageKey(userId, groupId);
  try {
    storage.setItem(key, JSON.stringify(todos));
  } catch (err) {
    console.error(`Erro ao salvar tarefas na chave ${key}:`, err);
  }
}

export interface SupabaseTaskClient {
  from(table: string): {
    insert(payload: unknown): Promise<{ error: unknown }>;
  };
}

export interface MigrationResult {
  success: boolean;
  migratedTasks: TodoItem[];
  error?: string;
}

/**
 * Executa a migração segura das tarefas locais do visitante para a nuvem do usuário autenticado.
 * - Cria um backup recuperável ('apptodo_migration_backup_<userId>').
 * - Só considera concluído após confirmação de sucesso de todas as inserções.
 * - Em caso de falha, mantém a cópia intacta e retorna os dados originais para que o usuário não perca nada.
 * - Em caso de sucesso, retorna a lista migrada para que o estado da tela seja populado com ela.
 */
export async function migrateGuestTasksToCloud(
  userId: string,
  supabaseClient: SupabaseTaskClient,
  customStorage?: StorageLike
): Promise<MigrationResult> {
  const storage = getSafeStorage(customStorage);
  if (!storage) {
    return { success: false, migratedTasks: [] };
  }

  const guestRaw = storage.getItem(GUEST_STORAGE_KEY);
  if (!guestRaw) {
    return { success: true, migratedTasks: [] };
  }

  let guestTasks: TodoItem[] = [];
  try {
    const parsed = JSON.parse(guestRaw);
    if (Array.isArray(parsed)) {
      guestTasks = parsed;
    }
  } catch {
    return { success: false, migratedTasks: [], error: 'JSON inválido no armazenamento local' };
  }

  // Se não há tarefas ou são apenas as tarefas de demonstração padrão, não migra lixo para a nuvem
  if (guestTasks.length === 0 || isOnlyDemoTasks(guestTasks)) {
    return { success: true, migratedTasks: [] };
  }

  // 1. Cria backup de recuperação ANTES de qualquer chamada de rede
  const backupKey = `apptodo_migration_backup_${userId}`;
  storage.setItem(backupKey, JSON.stringify(guestTasks));

  // 2. Insere tarefas e subtarefas no Supabase com validação individual
  const successfullyInserted: TodoItem[] = [];

  for (const item of guestTasks) {
    try {
      const { error: taskErr } = await supabaseClient.from('tasks').insert({
        id: item.id,
        user_id: userId,
        title: item.title,
        description: item.description || null,
        completed: item.completed,
        status: item.status || 'todo',
        priority: item.priority,
        category: item.category,
        due_date: item.dueDate || null,
        due_time: item.dueTime || null,
        pinned: item.pinned,
        pomodoros: item.pomodoros || 0,
        order_index: item.order || 0,
        created_at: item.createdAt,
        completed_at: item.completedAt || null,
        group_id: null,
      });

      if (taskErr) {
        console.error('Falha ao inserir tarefa durante migração:', taskErr);
        // Falha detectada: preserva cópia de segurança e não descarta nada
        return {
          success: false,
          migratedTasks: guestTasks,
          error: 'Falha na inserção da tarefa no banco de dados',
        };
      }

      if (item.subTasks && item.subTasks.length > 0) {
        const { error: subErr } = await supabaseClient.from('subtasks').insert(
          item.subTasks.map((s) => ({
            id: s.id,
            task_id: item.id,
            title: s.title,
            completed: s.completed,
          }))
        );

        if (subErr) {
          console.error('Falha ao inserir subtarefas durante migração:', subErr);
          return {
            success: false,
            migratedTasks: guestTasks,
            error: 'Falha na inserção de subtarefa no banco de dados',
          };
        }
      }

      successfullyInserted.push(item);
    } catch (err) {
      console.error('Erro de rede ou exceção durante migração:', err);
      return {
        success: false,
        migratedTasks: guestTasks,
        error: String(err),
      };
    }
  }

  // 3. Sucesso confirmado de todas as tarefas:
  // Salva no cache pessoal do usuário
  saveContextTodos(userId, null, successfullyInserted, storage);

  // Limpa o espaço de visitante para que um futuro logout encontre um espaço novo
  storage.setItem(GUEST_STORAGE_KEY, JSON.stringify([]));

  // Marca status da migração
  storage.setItem(`apptodo_migrated_${userId}`, 'true');

  return {
    success: true,
    migratedTasks: successfullyInserted,
  };
}

/**
 * Remove tarefas concluídas de uma lista sem afetar outros espaços.
 */
export function clearCompletedInContext(todos: TodoItem[]): {
  remaining: TodoItem[];
  removed: TodoItem[];
} {
  const remaining: TodoItem[] = [];
  const removed: TodoItem[] = [];
  for (const t of todos) {
    if (t.completed) {
      removed.push(t);
    } else {
      remaining.push(t);
    }
  }
  return { remaining, removed };
}

/**
 * Remove uma única tarefa preservando dados e índice para recuperação (desfazer).
 */
export function deleteTodoInContext(
  todos: TodoItem[],
  id: string
): {
  remaining: TodoItem[];
  deletedTask: TodoItem | null;
  index: number;
} {
  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    return { remaining: todos, deletedTask: null, index: -1 };
  }
  const deletedTask = todos[index];
  const remaining = todos.filter((t) => t.id !== id);
  return { remaining, deletedTask, index };
}

/**
 * Restaura uma tarefa previamente excluída no índice original ou no final.
 */
export function restoreTodoInContext(
  todos: TodoItem[],
  task: TodoItem,
  index?: number
): TodoItem[] {
  const updated = [...todos];
  const insertIndex =
    typeof index === 'number' && index >= 0 && index <= updated.length
      ? index
      : updated.length;
  updated.splice(insertIndex, 0, task);
  return updated;
}

/**
 * Prepara tarefas de exemplo (demonstração) isoladas para o espaço ativo:
 * - 'replace': substitui completamente a lista atual apenas deste espaço
 * - 'append': adiciona tarefas de exemplo com novos IDs exclusivos sem apagar as existentes
 */
export function prepareDemoTodos(
  existingTodos: TodoItem[],
  mode: 'replace' | 'append',
  groupId?: string | null
): TodoItem[] {
  if (mode === 'append') {
    const demoItems: TodoItem[] = INITIAL_TODOS.map((d, idx) => ({
      ...d,
      id: `demo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      groupId: groupId || undefined,
      subTasks: d.subTasks.map((st, sidx) => ({
        ...st,
        id: `sub-demo-${Date.now()}-${idx}-${sidx}`,
      })),
    }));
    return [...existingTodos, ...demoItems];
  }

  return INITIAL_TODOS.map((d) => ({
    ...d,
    groupId: groupId || undefined,
  }));
}

/**
 * Sanitiza e prepara tarefas importadas para o espaço especificado.
 * Respeita estritamente o groupId do espaço ativo e trata IDs repetidos com segurança.
 */
export function prepareImportTodos(
  existingTodos: TodoItem[],
  importedList: TodoItem[],
  mode: 'replace' | 'merge',
  groupId?: string | null
): TodoItem[] {
  return resolveImportTodos(existingTodos, importedList, mode, groupId);
}

export interface PendingSyncItem {
  id: string;
  taskId: string;
  action: 'upsert' | 'delete';
  contextId: string;
  task?: TodoItem;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export function getSyncQueueKey(userId?: string | null, groupId?: string | null): string {
  const context = getContextId(userId, groupId);
  return `apptodo_sync_queue_${context.replace(/:/g, '_')}`;
}

export function loadSyncQueue(
  userId?: string | null,
  groupId?: string | null,
  customStorage?: StorageLike
): PendingSyncItem[] {
  const storage = getSafeStorage(customStorage);
  if (!storage) return [];
  const key = getSyncQueueKey(userId, groupId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSyncQueue(
  userId: string | null | undefined,
  groupId: string | null | undefined,
  queue: PendingSyncItem[],
  customStorage?: StorageLike
): void {
  const storage = getSafeStorage(customStorage);
  if (!storage) return;
  const key = getSyncQueueKey(userId, groupId);
  try {
    storage.setItem(key, JSON.stringify(queue));
  } catch (err) {
    console.error('Falha ao salvar fila de sincronização:', err);
  }
}

/**
 * Adiciona uma ação à fila de sincronização protegendo contra duplicações.
 */
export function enqueueSyncItem(
  userId: string | null | undefined,
  groupId: string | null | undefined,
  item: {
    taskId: string;
    action: 'upsert' | 'delete';
    contextId: string;
    task?: TodoItem;
  },
  customStorage?: StorageLike
): PendingSyncItem[] {
  const currentQueue = loadSyncQueue(userId, groupId, customStorage);
  
  // Remove qualquer operação anterior sobre a mesma tarefa para desduplicação
  const filtered = currentQueue.filter((q) => q.taskId !== item.taskId);

  const newItem: PendingSyncItem = {
    id: `sync-op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    taskId: item.taskId,
    action: item.action,
    contextId: item.contextId,
    task: item.task,
    timestamp: Date.now(),
    retryCount: 0,
  };

  const updatedQueue = [...filtered, newItem];
  saveSyncQueue(userId, groupId, updatedQueue, customStorage);
  return updatedQueue;
}

/**
 * Remove uma tarefa da fila após confirmação de sucesso pelo Supabase.
 */
export function dequeueSyncItem(
  userId: string | null | undefined,
  groupId: string | null | undefined,
  taskId: string,
  customStorage?: StorageLike
): PendingSyncItem[] {
  const currentQueue = loadSyncQueue(userId, groupId, customStorage);
  const updatedQueue = currentQueue.filter((q) => q.taskId !== taskId);
  saveSyncQueue(userId, groupId, updatedQueue, customStorage);
  return updatedQueue;
}

/**
 * Política explícita de resolução de conflitos:
 * 1. Se a tarefa possui alteração pendente local (offline/não sincronizada), as alterações
 *    locais são preservadas para evitar descarte silencioso de edições do usuário.
 * 2. Se não houver alteração pendente local, aplica Last-Write-Wins (LWW) comparando timestamps.
 */
export function resolveTaskConflict(
  localTask: TodoItem,
  remoteTask: TodoItem,
  hasPendingLocalChange: boolean
): TodoItem {
  if (hasPendingLocalChange) {
    return {
      ...localTask,
      syncState: 'local_only',
    };
  }

  const localTime = new Date(localTask.updatedAt || localTask.completedAt || localTask.createdAt).getTime();
  const remoteTime = new Date(remoteTask.updatedAt || remoteTask.completedAt || remoteTask.createdAt).getTime();

  if (remoteTime >= localTime) {
    return {
      ...remoteTask,
      syncState: 'synced',
    };
  }

  return {
    ...localTask,
    syncState: 'synced',
  };
}

/**
 * Mescla dados remotos recebidos do Supabase com o estado local respeitando a fila de pendências.
 */
export function mergeCloudTasksWithLocal(
  localTasks: TodoItem[],
  remoteTasks: TodoItem[],
  pendingQueue: PendingSyncItem[]
): TodoItem[] {
  const pendingUpsertMap = new Map<string, PendingSyncItem>();
  const pendingDeleteSet = new Set<string>();

  for (const item of pendingQueue) {
    if (item.action === 'delete') {
      pendingDeleteSet.add(item.taskId);
    } else if (item.action === 'upsert') {
      pendingUpsertMap.set(item.taskId, item);
    }
  }

  const localMap = new Map<string, TodoItem>(localTasks.map((t) => [t.id, t]));
  const resultMap = new Map<string, TodoItem>();

  // 1. Processa tarefas que vieram do servidor remoto
  for (const remote of remoteTasks) {
    // Se a tarefa foi excluída localmente offline, não a ressuscita
    if (pendingDeleteSet.has(remote.id)) {
      continue;
    }

    const local = localMap.get(remote.id);
    const hasPendingChange = pendingUpsertMap.has(remote.id);

    if (local) {
      resultMap.set(remote.id, resolveTaskConflict(local, remote, hasPendingChange));
    } else if (!hasPendingChange) {
      resultMap.set(remote.id, { ...remote, syncState: 'synced' });
    }
  }

  // 2. Processa tarefas locais que ainda não estão no servidor (ex: criadas offline)
  for (const local of localTasks) {
    if (!resultMap.has(local.id)) {
      if (pendingUpsertMap.has(local.id) && !pendingDeleteSet.has(local.id)) {
        // Preserva a tarefa criada offline
        resultMap.set(local.id, {
          ...local,
          syncState: 'local_only',
        });
      }
    }
  }

  return Array.from(resultMap.values());
}

export interface SupabaseClientWithErrors {
  from(table: string): {
    select(columns?: string): {
      eq(col: string, val: unknown): Promise<{ data: unknown; error: unknown }>;
      [key: string]: unknown;
    };
    insert(payload: unknown): Promise<{ data?: unknown; error: unknown }>;
    upsert(payload: unknown): Promise<{ data?: unknown; error: unknown }>;
    update(payload: unknown): {
      eq(col: string, val: unknown): Promise<{ data?: unknown; error: unknown }>;
    };
    delete(): {
      eq(col: string, val: unknown): {
        eq?(col: string, val: unknown): Promise<{ data?: unknown; error: unknown }>;
        is?(col: string, val: unknown): Promise<{ data?: unknown; error: unknown }>;
        then(resolve: (value: { error: unknown }) => void): void;
      };
      is?(col: string, val: unknown): Promise<{ data?: unknown; error: unknown }>;
    };
  };
}

/**
 * Executa a sincronização segura de um item pendente da fila no Supabase.
 * Valida de forma estrita o campo { error } retornado pelo cliente.
 */
export async function syncPendingItemToCloud(
  item: PendingSyncItem,
  userId: string,
  groupId: string | null,
  client: SupabaseClientWithErrors
): Promise<{ success: boolean; error?: string }> {
  try {
    if (item.action === 'delete') {
      const { error } = await client.from('tasks').delete().eq('id', item.taskId);
      if (error) {
        const msg = typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Falha ao excluir no banco de dados';
        return { success: false, error: msg };
      }
      return { success: true };
    }

    if (item.action === 'upsert' && item.task) {
      const t = item.task;
      const { error: taskErr } = await client.from('tasks').upsert({
        id: t.id,
        user_id: userId,
        title: t.title,
        description: t.description || null,
        completed: t.completed,
        status: t.status || 'todo',
        priority: t.priority,
        category: t.category,
        due_date: t.dueDate || null,
        due_time: t.dueTime || null,
        pinned: t.pinned,
        pomodoros: t.pomodoros || 0,
        order_index: t.order || 0,
        created_at: t.createdAt,
        completed_at: t.completedAt || null,
        group_id: groupId || null,
      });

      if (taskErr) {
        const msg = typeof taskErr === 'object' && taskErr !== null && 'message' in taskErr
          ? String((taskErr as { message: unknown }).message)
          : 'Falha ao salvar tarefa no banco de dados';
        return { success: false, error: msg };
      }

      if (t.subTasks && t.subTasks.length > 0) {
        for (const st of t.subTasks) {
          const { error: subErr } = await client.from('subtasks').upsert({
            id: st.id,
            task_id: t.id,
            title: st.title,
            completed: st.completed,
          });
          if (subErr) {
            const msg = typeof subErr === 'object' && subErr !== null && 'message' in subErr
              ? String((subErr as { message: unknown }).message)
              : 'Falha ao salvar subtarefa no banco de dados';
            return { success: false, error: msg };
          }
        }
      }

      return { success: true };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}


