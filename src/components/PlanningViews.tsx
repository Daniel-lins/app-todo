"use client";

import { Trophy, Flag, CalendarDays } from "lucide-react";
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
  const undated = tasks.filter((t) => !t.dueDate && !t.completed);
  return (
    <section className="space-y-4" aria-label="Planejamento semanal">
      <p className="text-sm text-zinc-500">
        Organize os próximos sete dias. Toque em uma tarefa para ajustar o prazo
        e distribuir sua semana.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => {
          const list = tasks.filter((t) => t.dueDate === day);
          const pending = list.filter((t) => !t.completed).length;
          return (
            <article key={day} className={panel}>
              <h2 className="font-semibold flex gap-2 items-center">
                <CalendarDays size={16} className="text-indigo-500" />
                {new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                {pending} pendente{pending === 1 ? "" : "s"}
              </p>
              <div className="mt-3 space-y-1">
                {list.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onEdit(t)}
                    className={`block w-full text-left min-h-11 rounded-lg px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm break-words ${t.completed ? "line-through text-zinc-500" : ""}`}
                  >
                    {t.dueTime && (
                      <span className="text-xs text-zinc-500 mr-2">
                        {t.dueTime}
                      </span>
                    )}
                    {t.title}
                  </button>
                ))}
                {!list.length && (
                  <p className="text-sm text-zinc-500 py-3">Dia livre</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {undated.length > 0 && (
        <div className={panel}>
          <h2 className="font-semibold">Sem prazo · {undated.length}</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Escolha o dia para estas tarefas.
          </p>
          {undated.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onEdit(t)}
              className="block min-h-11 text-sm text-indigo-600 dark:text-indigo-400 text-left break-words"
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
