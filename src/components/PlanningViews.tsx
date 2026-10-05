"use client";

import { useState } from "react";
import { Trophy, Flag, CalendarDays, ChevronRight } from "lucide-react";
import type { TodoItem, RpgBadge, GroupMember } from "../types/todo";
import { getLocalDateString } from "../utils/dateUtils";

const panel =
  "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5";
const dateLabel = (date: string) =>
  new Date(date.length === 10 ? `${date}T12:00:00` : date).toLocaleDateString(
    "pt-BR",
    { day: "numeric", month: "short" },
  );

export function MissionsView({
  tasks,
  onEdit,
  onStep,
  onCreate,
  members = [],
}: {
  members?: GroupMember[];
  tasks: TodoItem[];
  onEdit: (t: TodoItem) => void;
  onStep: (id: string, step: string) => void;
  onCreate: (title?: string, steps?: string[]) => void;
}) {
  return (
    <section aria-label="Missões grandes" className="space-y-4">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-lg">
          Transforme um objetivo real em etapas. Sua missão vira uma conquista
          quando todas estiverem feitas.
        </p>
      </div>
      {!tasks.length && (
        <div className={`${panel} space-y-4`}>
          <Flag className="text-indigo-500" />
          <h2 className="font-semibold">Qual é seu próximo grande objetivo?</h2>
          <p className="text-sm text-zinc-500">
            Comece do zero ou personalize um exemplo.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 text-sm"
              onClick={() =>
                onCreate(
                  "Ler dez livros",
                  Array.from({ length: 10 }, (_, i) => `Livro ${i + 1}`),
                )
              }
            >
              Ler dez livros
            </button>
            <button
              type="button"
              className="min-h-11 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 text-sm"
              onClick={() =>
                onCreate("Tirar minha CNH", [
                  "Escolher a autoescola",
                  "Concluir as aulas teóricas",
                  "Passar na prova teórica",
                  "Concluir as aulas práticas",
                  "Passar na prova prática",
                ])
              }
            >
              Tirar CNH
            </button>
          </div>
        </div>
      )}
      {tasks.map((task) => {
        const done = task.subTasks.filter((s) => s.completed).length;
        const next = task.subTasks.find((s) => !s.completed);
        return (
          <article key={task.id} className={`${panel} space-y-3`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold break-words">{task.title}</h2>
                {task.assignedTo && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                    Responsável:{" "}
                    {members.find((m) => m.userId === task.assignedTo)
                      ?.displayName || "Membro"}
                  </p>
                )}
                <p className="text-xs text-zinc-500 mt-1">
                  {task.completed
                    ? "Conquista realizada"
                    : `${done} de ${task.subTasks.length} etapas concluídas`}
                  {task.dueDate ? ` · Até ${dateLabel(task.dueDate)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="min-h-11 px-3 text-sm text-indigo-600 dark:text-indigo-400 shrink-0"
              >
                Editar
              </button>
            </div>
            <div
              role="progressbar"
              aria-label={`Progresso de ${task.title}`}
              aria-valuemin={0}
              aria-valuemax={task.subTasks.length}
              aria-valuenow={done}
              className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
            >
              <div
                className="h-full bg-indigo-500"
                style={{
                  width: `${task.subTasks.length ? (done / task.subTasks.length) * 100 : 0}%`,
                }}
              />
            </div>
            {next && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Próxima etapa:{" "}
                <strong className="font-medium">{next.title}</strong>
              </p>
            )}
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {task.subTasks.map((step) => (
                <li key={step.id} className="py-2">
                  <label className="flex min-h-11 items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.completed}
                      onChange={() => onStep(task.id, step.id)}
                      className="w-4 h-4 shrink-0"
                    />
                    <span
                      className={`text-sm break-words ${step.completed ? "line-through text-zinc-500" : ""}`}
                    >
                      {step.title}
                    </span>
                  </label>
                  {step.completed && step.completedBy && (
                    <p className="text-xs text-zinc-500 ml-7">
                      Concluída por{" "}
                      {members.find((m) => m.userId === step.completedBy)
                        ?.displayName || "Membro"}
                      {step.completedAt
                        ? ` em ${dateLabel(step.completedAt)}`
                        : ""}
                    </p>
                  )}
                  {step.dueDate && (
                    <p className="text-xs text-zinc-500 ml-7">
                      Prazo: {dateLabel(step.dueDate)}
                    </p>
                  )}
                  {step.notes && (
                    <p className="text-sm text-zinc-500 ml-7 whitespace-pre-wrap break-words">
                      {step.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}

export function AchievementsView({
  badges,
  history,
  today,
}: {
  badges: RpgBadge[];
  history: TodoItem[];
  today: string;
}) {
  const unlocked = badges
    .filter((b) => b.unlocked)
    .sort((a, b) => (b.unlockedAt || "").localeCompare(a.unlockedAt || ""));
  const start = new Date(`${today}T12:00:00`);
  start.setDate(start.getDate() - 6);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return getLocalDateString(d);
  });
  const counts = days.map(
    (day) =>
      history.filter(
        (t) =>
          t.completed &&
          t.completedAt &&
          getLocalDateString(new Date(t.completedAt)) === day,
      ).length,
  );
  return (
    <section className="space-y-6" aria-label="Conquistas">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Seus objetivos realizados, incluindo missões arquivadas. Tarefas comuns
        continuam contando para sua evolução.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {unlocked.map((badge) => (
          <article key={badge.id} className={panel}>
            <Trophy className="text-amber-500 mb-3" />
            <h2 className="font-semibold break-words">{badge.title}</h2>
            <p className="text-sm text-zinc-500 mt-2">{badge.description}</p>
            {badge.unlockedAt && (
              <p className="text-xs text-zinc-500 mt-3">
                Realizada em {dateLabel(badge.unlockedAt)}
              </p>
            )}
          </article>
        ))}
      </div>
      {!unlocked.length && (
        <div className={`${panel} text-sm text-zinc-500`}>
          Sua primeira conquista aparecerá aqui ao concluir uma missão grande.
        </div>
      )}
      <div className={panel}>
        <h2 className="font-semibold">Conclusões nos últimos sete dias</h2>
        <p className="text-sm text-zinc-500 mt-1">
          {counts.reduce((a, b) => a + b, 0)} tarefas e missões concluídas neste
          período.
        </p>
        <div className="grid grid-cols-7 gap-2 mt-5">
          {days.map((day, i) => (
            <div key={day} className="text-center">
              <span className="block text-lg font-semibold tabular-nums">
                {counts[i]}
              </span>
              <span className="text-xs text-zinc-500">
                {new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "short",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WeeklyPlanner({
  tasks,
  today,
  onEdit,
}: {
  tasks: TodoItem[];
  today: string;
  onEdit: (task: TodoItem) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + i);
    return getLocalDateString(d);
  });
  const [selectedDay, setSelectedDay] = useState(today);
  const activeDay = days.includes(selectedDay) ? selectedDay : today;
  const byTime = (a: TodoItem, b: TodoItem) =>
    Number(a.completed) - Number(b.completed) ||
    (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99") ||
    a.title.localeCompare(b.title, "pt-BR");
  const undated = tasks.filter((t) => !t.dueDate && !t.completed).sort(byTime);
  const overdue = tasks
    .filter((t) => t.dueDate && t.dueDate < today && !t.completed)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || byTime(a, b));
  const dayTasks = (day: string) =>
    tasks.filter((t) => t.dueDate === day).sort(byTime);
  const selectedTasks = dayTasks(activeDay);
  const pendingCount = (list: TodoItem[]) =>
    list.filter((t) => !t.completed).length;
  const weekday = (day: string, short = false) =>
    new Date(`${day}T12:00:00`)
      .toLocaleDateString("pt-BR", {
        weekday: short ? "short" : "long",
      })
      .replace(".", "");
  const renderTask = (task: TodoItem, showDate = false) => (
    <button
      key={task.id}
      type="button"
      onClick={() => onEdit(task)}
      className="flex w-full min-h-14 items-center gap-3 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2"
    >
      <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-600 dark:text-zinc-400 text-center">
        {showDate && task.dueDate
          ? dateLabel(task.dueDate)
          : task.dueTime || "Sem hora"}
      </span>
      <span
        className={`min-w-0 flex-1 text-sm [overflow-wrap:anywhere] ${task.completed ? "line-through text-zinc-500 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100"}`}
      >
        {task.title}
        {task.kind === "mission" && (
          <span className="block mt-1 text-xs text-zinc-500 dark:text-zinc-400 no-underline">
            Missão · {task.subTasks.filter((s) => s.completed).length}/
            {task.subTasks.length} etapas
          </span>
        )}
      </span>
      <ChevronRight
        size={16}
        aria-hidden="true"
        className="shrink-0 text-zinc-400"
      />
    </button>
  );
  return (
    <section className="space-y-5" aria-label="Planejamento semanal">
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {dateLabel(days[0])} — {dateLabel(days[6])}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Toque em uma tarefa para editar ou reagendar.
        </p>
      </div>
      <div className="md:hidden space-y-5">
        <div
          className="overflow-x-auto pb-1"
          aria-label="Escolher dia da semana"
        >
          <div className="grid grid-cols-7 gap-1 min-w-[322px]">
            {days.map((day) => {
              const pending = pendingCount(dayTasks(day));
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={activeDay === day}
                  aria-controls="weekly-selected-day"
                  aria-label={`${weekday(day)}, ${dateLabel(day)}${day === today ? ", hoje" : ""}, ${pending} pendentes`}
                  onClick={() => setSelectedDay(day)}
                  className={`flex min-h-20 min-w-11 flex-col items-center justify-center gap-1 rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2 ${activeDay === day ? "bg-indigo-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
                >
                  <span className="text-xs capitalize">
                    {weekday(day, true)}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {Number(day.slice(-2))}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${pending ? (activeDay === day ? "bg-white" : "bg-indigo-600 dark:bg-indigo-400") : "bg-transparent"}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
        <div id="weekly-selected-day" className={panel}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="font-semibold">
              {activeDay === today ? "Hoje" : weekday(activeDay)}{" "}
              <span className="font-normal text-sm text-zinc-500 dark:text-zinc-400">
                · {dateLabel(activeDay)}
              </span>
            </h2>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {pendingCount(selectedTasks)} pendente
              {pendingCount(selectedTasks) === 1 ? "" : "s"}
            </span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {selectedTasks.map((t) => renderTask(t))}
          </div>
          {!selectedTasks.length && (
            <p className="py-5 text-sm text-zinc-600 dark:text-zinc-400">
              Nenhuma tarefa para este dia.
            </p>
          )}
        </div>
      </div>
      <div className="hidden md:grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => {
          const list = dayTasks(day);
          const pending = pendingCount(list);
          return (
            <article key={day} className={panel}>
              <h2 className="font-semibold flex gap-2 items-center">
                <CalendarDays
                  size={16}
                  aria-hidden="true"
                  className="text-indigo-500 shrink-0"
                />
                {weekday(day)} · {dateLabel(day)}
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                {pending} pendente{pending === 1 ? "" : "s"}
              </p>
              <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {list.map((t) => renderTask(t))}
              </div>
              {!list.length && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 py-3">
                  Dia livre
                </p>
              )}
            </article>
          );
        })}
      </div>
      {[
        {
          title: "Atrasadas",
          list: overdue,
          description: "Reagende as tarefas que ficaram para trás.",
          showDate: true,
        },
        {
          title: "Sem prazo",
          list: undated,
          description: "Escolha um dia para estas tarefas.",
          showDate: false,
        },
      ]
        .filter(({ list }) => list.length)
        .map(({ title, list, description, showDate }) => (
          <details key={title} className={panel}>
            <summary className="min-h-11 cursor-pointer font-semibold content-center rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-500">
              {title}{" "}
              <span className="ml-2 font-normal text-sm text-zinc-600 dark:text-zinc-400">
                {list.length}
              </span>
            </summary>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 mb-2">
              {description}
            </p>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {list.map((t) => renderTask(t, showDate))}
            </div>
          </details>
        ))}
    </section>
  );
}
