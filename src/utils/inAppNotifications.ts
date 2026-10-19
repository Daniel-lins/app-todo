import type { TodoItem } from "../types/todo";
import type { StorageLike } from "./todoStorage";
import { getLocalDateString } from "./dateUtils";
export interface InAppNotice {
  id: string;
  taskId?: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind: "start" | "deadline" | "overdue" | "focus";
}
export interface InboxState {
  items: InAppNotice[];
  seen: Record<string, string>;
}
export const inboxKey = (scope: string) => `apptodo_inbox_v1:${scope}`;
const empty = (): InboxState => ({ items: [], seen: {} });
export function parseInbox(raw: string | null): InboxState {
  try {
    const v = JSON.parse(raw || "{}");
    if (
      !v ||
      !Array.isArray(v.items) ||
      !v.seen ||
      typeof v.seen !== "object" ||
      Array.isArray(v.seen)
    )
      return empty();
    return {
      items: v.items
        .filter(
          (x: InAppNotice) =>
            x &&
            typeof x.id === "string" &&
            typeof x.title === "string" &&
            typeof x.body === "string" &&
            typeof x.createdAt === "string" &&
            Number.isFinite(Date.parse(x.createdAt)) &&
            typeof x.read === "boolean" &&
            ["start", "deadline", "overdue", "focus"].includes(x.kind) &&
            (x.taskId === undefined || typeof x.taskId === "string"),
        )
        .slice(0, 200),
      seen: Object.fromEntries(
        Object.entries(v.seen)
          .filter(
            ([id, at]) =>
              id.length <= 1000 &&
              typeof at === "string" &&
              Number.isFinite(Date.parse(at)),
          )
          .slice(-5000),
      ) as Record<string, string>,
    };
  } catch {
    return empty();
  }
}
export function taskNotices(
  tasks: TodoItem[],
  now = new Date(),
): InAppNotice[] {
  const today = getLocalDateString(now);
  const oldest = new Date(now);
  oldest.setDate(oldest.getDate() - 30);
  const oldestDay = getLocalDateString(oldest);
  const result: InAppNotice[] = [];
  const add = (
    t: TodoItem,
    kind: InAppNotice["kind"],
    title: string,
    date: string,
    time = "",
  ) =>
    result.push({
      id: JSON.stringify([kind, t.id, date, time]),
      taskId: t.id,
      kind,
      title,
      body: t.title.slice(0, 300),
      createdAt: now.toISOString(),
      read: false,
    });
  for (const task of tasks) {
    if (task.completed) continue;
    const p = task.actionPlan;
    if (p?.startDate === today) {
      const scheduled = p.startTime
        ? new Date(`${today}T${p.startTime}:00`).getTime()
        : new Date(`${today}T00:00:00`).getTime();
      if (
        now.getTime() >= scheduled &&
        !p.events?.some(
          (e) => e.kind === "started" && Date.parse(e.at) >= scheduled,
        )
      )
        add(
          task,
          "start",
          p.startTime ? "Hora de começar" : "Início planejado para hoje",
          today,
          p.startTime,
        );
    }
    if (!task.dueDate || task.dueDate < oldestDay) continue;
    if (task.dueDate < today)
      add(
        task,
        "overdue",
        "Tarefa com prazo vencido",
        task.dueDate,
        task.dueTime,
      );
    else if (task.dueDate === today) {
      if (!task.dueTime) add(task, "deadline", "Prazo para hoje", today);
      else {
        const due = new Date(`${today}T${task.dueTime}:00`).getTime();
        if (now.getTime() >= due)
          add(task, "overdue", "Prazo vencido hoje", today, task.dueTime);
        else if (due - now.getTime() <= 15 * 60_000)
          add(
            task,
            "deadline",
            "Prazo nos próximos 15 minutos",
            today,
            task.dueTime,
          );
      }
    }
  }
  return result;
}
export function mergeNotices(
  state: InboxState,
  incoming: InAppNotice[],
  now = new Date(),
): InboxState {
  const cutoff = now.getTime() - 31 * 86400_000;
  const seen = Object.fromEntries(
    Object.entries(state.seen).filter(([, at]) => Date.parse(at) >= cutoff),
  );
  const items = state.items.filter((x) => Date.parse(x.createdAt) >= cutoff);
  for (const item of incoming) {
    if (seen[item.id] || Object.keys(seen).length >= 5000) continue;
    seen[item.id] = now.toISOString();
    items.unshift(item);
  }
  return {
    items: items
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200),
    seen,
  };
}
export function collectInbox(
  storage: StorageLike,
  scope: string,
  tasks: TodoItem[],
  now = new Date(),
) {
  const key = inboxKey(scope);
  const raw = storage.getItem(key);
  const next = JSON.stringify(
    mergeNotices(parseInbox(raw), taskNotices(tasks, now), now),
  );
  if (next !== raw) storage.setItem(key, next);
  return next;
}
export function markInboxRead(
  storage: StorageLike,
  scope: string,
  id?: string,
) {
  const key = inboxKey(scope);
  const state = parseInbox(storage.getItem(key));
  storage.setItem(
    key,
    JSON.stringify({
      ...state,
      items: state.items.map((item) =>
        !id || item.id === id ? { ...item, read: true } : item,
      ),
    }),
  );
}
export function addFocusNotice(
  scope: string,
  sessionId: string,
  title: string,
  taskId?: string,
) {
  const key = inboxKey(scope);
  const now = new Date();
  const notice: InAppNotice = {
    id: JSON.stringify(["focus", sessionId]),
    kind: "focus",
    taskId,
    title,
    body: "O tempo terminou. Abra a tarefa para revisar o próximo passo.",
    createdAt: now.toISOString(),
    read: false,
  };
  localStorage.setItem(
    key,
    JSON.stringify(
      mergeNotices(parseInbox(localStorage.getItem(key)), [notice], now),
    ),
  );
  window.dispatchEvent(new Event("apptodo-inbox"));
}
