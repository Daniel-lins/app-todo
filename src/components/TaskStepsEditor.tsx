"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { SubTask } from "../types/todo";

const inputClass =
  "w-full min-h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100";

export function TaskStepsEditor({
  steps,
  onChange,
}: {
  steps: SubTask[];
  onChange: (steps: SubTask[]) => void;
}) {
  const [title, setTitle] = useState("");
  function update(id: string, patch: Partial<SubTask>) {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function move(index: number, delta: number) {
    const next = [...steps];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  }
  function add() {
    if (!title.trim() || steps.length >= 50) return;
    onChange([
      ...steps,
      { id: crypto.randomUUID(), title: title.trim(), completed: false },
    ]);
    setTitle("");
  }
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold mb-2">
        Etapas ({steps.length}/50)
      </legend>
      {steps.map((step, index) => (
        <div
          key={step.id}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2"
        >
          <div className="flex gap-2 items-center">
            <label className="min-h-11 min-w-11 flex items-center justify-center">
              <input
                type="checkbox"
                aria-label={`Concluir etapa ${index + 1}`}
                checked={step.completed}
                onChange={(e) =>
                  update(step.id, {
                    completed: e.target.checked,
                    completedAt: e.target.checked
                      ? new Date().toISOString()
                      : undefined,
                    completedBy: undefined,
                  })
                }
              />
            </label>
            <input
              className={inputClass}
              aria-label={`Nome da etapa ${index + 1}`}
              required
              maxLength={500}
              value={step.title}
              onChange={(e) => update(step.id, { title: e.target.value })}
            />
          </div>
          <details>
            <summary className="min-h-11 flex items-center cursor-pointer text-sm text-indigo-600 dark:text-indigo-400">
              Prazo, notas e ordem
            </summary>
            <div className="space-y-2 pt-2">
              <label className="block text-sm">
                Prazo da etapa
                <input
                  type="date"
                  className={inputClass}
                  value={step.dueDate || ""}
                  onChange={(e) =>
                    update(step.id, { dueDate: e.target.value || undefined })
                  }
                />
              </label>
              <label className="block text-sm">
                Notas
                <textarea
                  className={`${inputClass} py-2`}
                  maxLength={5000}
                  rows={2}
                  value={step.notes || ""}
                  onChange={(e) =>
                    update(step.id, { notes: e.target.value || undefined })
                  }
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-30"
                  aria-label={`Mover etapa ${index + 1} para cima`}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  disabled={index === steps.length - 1}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-30"
                  aria-label={`Mover etapa ${index + 1} para baixo`}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="min-h-11 px-3 flex items-center gap-2 text-rose-600 dark:text-rose-400"
                  onClick={() =>
                    onChange(steps.filter((s) => s.id !== step.id))
                  }
                >
                  <Trash2 size={16} />
                  Remover
                </button>
              </div>
            </div>
          </details>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          id="task-new-subtask-input"
          aria-label="Nova etapa"
          className={`${inputClass} min-w-0`}
          maxLength={500}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Ler o primeiro livro"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          disabled={!title.trim() || steps.length >= 50}
          className="min-h-11 px-3 rounded-lg bg-indigo-600 text-white disabled:opacity-40 flex items-center gap-1"
          onClick={add}
        >
          <Plus size={16} />
          Incluir
        </button>
      </div>
    </fieldset>
  );
}
