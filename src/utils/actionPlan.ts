import type { ActionPlan, TodoItem } from "../types/todo";
import { getLocalDateString } from "./dateUtils";

const text = (v: unknown, max = 300) =>
  typeof v === "string" ? v.trim().slice(0, max) || undefined : undefined;
const validDate = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v + "T12:00:00")) &&
  getLocalDateString(new Date(v + "T12:00:00")) === v;
export function cleanActionPlan(value: unknown): ActionPlan | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const v = value as Record<string, unknown>;
  const events: NonNullable<ActionPlan["events"]> = [];
  const ids = new Set<string>();
  if (Array.isArray(v.events))
    for (const raw of v.events.slice(-200)) {
      if (!raw || typeof raw !== "object") continue;
      const e = raw as Record<string, unknown>;
      if (
        typeof e.id !== "string" ||
        e.id.length > 100 ||
        ids.has(e.id) ||
        typeof e.at !== "string" ||
        Number.isNaN(Date.parse(e.at)) ||
        !["started", "advanced"].includes(String(e.kind))
      )
        continue;
      ids.add(e.id);
      events.push({
        id: e.id,
        at: new Date(e.at).toISOString(),
        kind: e.kind as "started" | "advanced",
        note: text(e.note, 500),
      });
    }
  return {
    nextAction: text(v.nextAction),
    startDate: validDate(v.startDate) ? (v.startDate as string) : undefined,
    startTime:
      typeof v.startTime === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(v.startTime)
        ? v.startTime
        : undefined,
    cue: text(v.cue),
    place: text(v.place),
    obstacle: text(v.obstacle),
    response: text(v.response),
    events,
  };
}
export function nextAction(task: TodoItem) {
  return (
    task.actionPlan?.nextAction ||
    task.subTasks.find((s) => !s.completed)?.title ||
    task.title
  );
}
export function withActionEvent(
  task: TodoItem,
  kind: "started" | "advanced",
  note = "",
  now = new Date().toISOString(),
  id = crypto.randomUUID(),
): ActionPlan {
  const plan = cleanActionPlan(task.actionPlan) || {};
  return {
    ...plan,
    events: [
      ...(plan.events || []),
      { id, at: now, kind, note: text(note, 500) },
    ].slice(-200),
  };
}
export function actionMetrics(tasks: TodoItem[], day: string) {
  const has = (t: TodoItem, kind: "started" | "advanced") =>
    t.actionPlan?.events?.some(
      (e) => e.kind === kind && getLocalDateString(new Date(e.at)) === day,
    );
  return {
    planned: tasks.filter((t) => t.actionPlan?.startDate === day).length,
    started: tasks.filter((t) => has(t, "started")).length,
    advanced: tasks.filter((t) => has(t, "advanced")).length,
    completed: tasks.filter(
      (t) =>
        t.completed &&
        t.completedAt &&
        getLocalDateString(new Date(t.completedAt)) === day,
    ).length,
  };
}
export function startReminderDue(task: TodoItem, now: Date) {
  const p = task.actionPlan;
  if (task.completed || !p?.startDate || !p.startTime) return false;
  const at = new Date(`${p.startDate}T${p.startTime}:00`).getTime();
  const elapsed = now.getTime() - at;
  return (
    elapsed >= 0 &&
    elapsed < 15 * 60_000 &&
    !p.events?.some((e) => e.kind === "started" && Date.parse(e.at) >= at)
  );
}
