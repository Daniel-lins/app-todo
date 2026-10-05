import type { TodoItem } from "../types/todo";
import { getLocalDateString } from "./dateUtils";

export function nextOccurrence(
  task: TodoItem,
  now = new Date(),
): TodoItem | null {
  if (!task.completed || !task.recurrence || task.kind === "mission")
    return null;
  const base = task.dueDate || getLocalDateString(now);
  const date = new Date(`${base}T12:00:00`);
  if (Number.isNaN(date.getTime()))
    throw new Error("A data da repetição é inválida.");
  if (task.recurrence === "monthly") {
    const day = task.recurrenceAnchorDay || date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, last));
  } else date.setDate(date.getDate() + (task.recurrence === "weekly" ? 7 : 1));
  const dueDate = getLocalDateString(date);
  const series = task.recurrenceSeriesId || task.id;
  return {
    ...task,
    id: `repeat:${series}:${dueDate}`,
    recurrenceSeriesId: series,
    recurrenceAnchorDay:
      task.recurrenceAnchorDay || new Date(`${base}T12:00:00`).getDate(),
    dueDate,
    completed: false,
    completedAt: undefined,
    status: "todo",
    pomodoros: 0,
    pomodoroSessionIds: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    subTasks: task.subTasks.map((step, i) => ({
      ...step,
      id: `repeat:${series}:${dueDate}:step:${i}`,
      completed: false,
      completedBy: undefined,
      completedAt: undefined,
      dueDate: undefined,
    })),
  };
}

export function isInView(task: TodoItem, view: string, today: string): boolean {
  if (view === "today")
    return (
      task.dueDate === today ||
      (!task.completed && !!task.dueDate && task.dueDate < today)
    );
  if (view === "missions") return task.kind === "mission";
  if (view === "achievements") return false;
  if (view === "week") {
    const end = new Date(`${today}T12:00:00`);
    end.setDate(end.getDate() + 6);
    return (
      !!task.dueDate &&
      task.dueDate >= today &&
      task.dueDate <= getLocalDateString(end)
    );
  }
  return true;
}
