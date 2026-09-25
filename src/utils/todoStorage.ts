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
  return todos.every((task, index) => JSON.stringify(task) === JSON.stringify(INITIAL_TODOS[index]));
}

function getSafeStorage(customStorage?: StorageLike): StorageLike | null {
  if (customStorage) return customStorage;
  try {
    if (typeof window !== 'undefined') return window.localStorage;
  } catch { /* Storage may be blocked by the browser. */ }
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
      storage.setItem('apptodo_guest_demo_snapshot', JSON.stringify(INITIAL_TODOS));
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
  if (!storage) throw new Error('Armazenamento local indisponível. Libere o acesso para salvar suas tarefas.');

  const key = getStorageKey(userId, groupId);
  try {
    storage.setItem(key, JSON.stringify(todos));
  } catch (err) {
    throw new Error('Não foi possível salvar neste dispositivo. Verifique o espaço disponível.', { cause: err });
  }
}

export type SupabaseTaskClient = import('./taskPersistence').TaskTransport;

export interface MigrationResult {
  success: boolean;
  migratedTasks: TodoItem[];
  error?: string;
}

/** Copies guest tasks into a durable personal outbox before releasing the guest space. */
export async function migrateGuestTasksToCloud(
  userId: string, client: SupabaseTaskClient, customStorage?: StorageLike,
): Promise<MigrationResult> {
  const storage = getSafeStorage(customStorage);
  if (!storage) return { success: false, migratedTasks: [], error: 'Armazenamento indisponível.' };
  let tasks: TodoItem[] = [];
  try {
    const raw = storage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return { success: true, migratedTasks: [] };
    tasks = JSON.parse(raw);
    if (!Array.isArray(tasks)) throw new Error('Backup local inválido.');
    if (!tasks.length || isOnlyDemoTasks(tasks) || raw === storage.getItem('apptodo_guest_demo_snapshot')) return { success: true, migratedTasks: [] };
    const ownerKey = 'apptodo_guest_migration_owner';
    const owner = storage.getItem(ownerKey);
    if (owner && owner !== userId) return { success: false, migratedTasks: [], error: 'Há uma migração pendente em outra conta.' };
    storage.setItem(ownerKey, userId);
    storage.setItem(`apptodo_migration_backup_${userId}`, raw);
    const { stageTaskChanges, flushTaskChanges } = await import('./taskPersistence');
    const cache = loadContextTodos(userId, null, storage).todos;
    const ids = new Set(cache.map(task => task.id));
    const mapKey = `apptodo_guest_migration_ids_${userId}`;
    const idMap: Record<string, string> = JSON.parse(storage.getItem(mapKey) || '{}');
    const mapped = tasks.map(task => {
      idMap[task.id] ||= crypto.randomUUID();
      return { ...task, id: idMap[task.id], groupId: undefined, syncState: 'local_only' as const,
        subTasks: task.subTasks.map(st => {
          const key = `${task.id}:sub:${st.id}`;
          idMap[key] ||= crypto.randomUUID();
          return { ...st, id: idMap[key] };
        }) };
    });
    storage.setItem(mapKey, JSON.stringify(idMap));
    const incoming = mapped.filter(task => !ids.has(task.id));
    stageTaskChanges(userId, null, [...cache, ...incoming], incoming, [], storage);
    await flushTaskChanges(client, userId, null, storage);
    if (storage.getItem(GUEST_STORAGE_KEY) === raw) storage.setItem(GUEST_STORAGE_KEY, '[]');
    storage.removeItem?.(ownerKey);
    storage.removeItem?.(mapKey);
    return { success: true, migratedTasks: tasks };
  } catch (error) {
    return { success: false, migratedTasks: tasks, error: error instanceof Error ? error.message : String(error) };
  }
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
  const updated = todos.filter(item => item.id !== task.id);
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
  const items = INITIAL_TODOS.map(d => ({
    ...d, id: crypto.randomUUID(), groupId: groupId || undefined,
    subTasks: d.subTasks.map(st => ({ ...st, id: crypto.randomUUID() })),
  }));
  return mode === 'append' ? [...existingTodos, ...items] : items;
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
  if (!storage) throw new Error('Armazenamento local indisponível para salvar alterações pendentes.');
  const key = getSyncQueueKey(userId, groupId);
  try {
    storage.setItem(key, JSON.stringify(queue));
  } catch (err) {
    throw new Error('Não foi possível preservar a fila de alterações.', { cause: err });
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
 * 2. Sem alteração pendente, usa a versão confirmada pelo servidor.
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

  // Once the outbox is empty, the server is authoritative. Device clock skew
  // must not permanently mask a teammate's newer server commit.
  return { ...remoteTask, syncState: 'synced' };
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

  for (const op of pendingUpsertMap.values()) {
    if (op.task && !pendingDeleteSet.has(op.taskId)) {
      resultMap.set(op.taskId, { ...op.task, syncState: 'local_only' });
    }
  }
  return Array.from(resultMap.values());
}

export type SupabaseClientWithErrors = import('./taskPersistence').TaskTransport;

export async function syncPendingItemToCloud(
  item: PendingSyncItem, userId: string, groupId: string | null, client: SupabaseClientWithErrors,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sendTaskChanges } = await import('./taskPersistence');
    await sendTaskChanges(client, userId, groupId, [item]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
