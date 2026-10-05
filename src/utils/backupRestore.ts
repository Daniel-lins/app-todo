import type { TodoItem } from "../types/todo";

/** Stable, space-specific IDs make a full backup safe to import more than once. */
export function prepareFullRestore(
  current: TodoItem[],
  history: TodoItem[],
  imported: TodoItem[],
  rewards: TodoItem[],
  contextId: string,
  groupId: string | null,
  mode: "merge" | "replace",
) {
  const known = new Set([...history, ...current].map((t) => t.id));
  const prefix = `restore:${contextId}:`;
  const mappedId = (id: string): string => {
    if (known.has(id) || id.startsWith(prefix)) return id;
    const repeated = /^repeat:(.*):(\d{4}-\d{2}-\d{2})$/.exec(id);
    return repeated
      ? `repeat:${mappedId(repeated[1])}:${repeated[2]}`
      : `${prefix}${id}`;
  };
  const tasks = imported.map((t) => ({
    ...t,
    id: mappedId(t.id),
    groupId: groupId || undefined,
    assignedTo: undefined,
    recurrenceSeriesId: t.recurrenceSeriesId
      ? mappedId(t.recurrenceSeriesId)
      : undefined,
    subTasks: t.subTasks.map((step, i) => ({
      ...step,
      id: `${mappedId(t.id)}:step:${i}`,
      completedBy: undefined,
    })),
    updatedAt: new Date().toISOString(),
  }));
  const activeIds = new Set(
    [...tasks, ...(mode === "merge" ? current : [])].map((t) => t.id),
  );
  const archived = rewards
    .filter((t) => !activeIds.has(mappedId(t.id)))
    .map((t) => ({ ...t, id: mappedId(t.id) }));
  const existingIds = new Set(current.map((t) => t.id));
  return {
    next:
      mode === "replace"
        ? tasks
        : [...current, ...tasks.filter((t) => !existingIds.has(t.id))],
    archived,
    newArchives: archived.filter((t) => !known.has(t.id)),
  };
}
