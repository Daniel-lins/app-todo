"use client";
import type { Dispatch, SetStateAction } from "react";
import type { ActionPlan } from "../types/todo";
export const planInput =
  "block mt-1.5 w-full min-h-11 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-indigo-500";
export function ActionPlanFields({
  value,
  onChange,
  grouped = false,
}: {
  value: ActionPlan;
  onChange: Dispatch<SetStateAction<ActionPlan>>;
  grouped?: boolean;
}) {
  const update = (key: keyof ActionPlan, next: string) =>
    onChange((previous) => ({ ...previous, [key]: next }));
  const field = (key: keyof ActionPlan, label: string, placeholder: string) => (
    <label className="block text-sm" key={key}>
      {label}
      <input
        className={planInput}
        maxLength={300}
        value={typeof value[key] === "string" ? value[key] : ""}
        onChange={(e) => update(key, e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
  return (
    <details
      className="border-t border-zinc-200 dark:border-zinc-800 pt-3"
      open={undefined}
    >
      <summary className="cursor-pointer min-h-11 content-center font-medium text-sm">
        Plano para começar (opcional)
      </summary>
      <div className="space-y-4 pt-3">
        {grouped && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Este plano faz parte da tarefa compartilhada e ficará visível aos
            membros do grupo. Evite informações privadas.
          </p>
        )}
        {field(
          "nextAction",
          "Próxima ação concreta",
          "Ex.: abrir o capítulo 3 e resolver uma questão",
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm min-w-0">
            Dia de início
            <input
              type="date"
              className={planInput + " min-w-0"}
              value={value.startDate || ""}
              onInput={(e) => update("startDate", e.currentTarget.value)}
              onChange={(e) => update("startDate", e.target.value)}
            />
          </label>
          <label className="text-sm min-w-0">
            Hora de início
            <input
              type="time"
              className={planInput + " min-w-0"}
              value={value.startTime || ""}
              onInput={(e) => update("startTime", e.currentTarget.value)}
              onChange={(e) => update("startTime", e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Início é diferente do prazo de entrega. O aviso de início funciona com
          o app aberto e notificações permitidas.
        </p>
        {field(
          "cue",
          "Depois de qual situação?",
          "Ex.: depois do café da manhã",
        )}
        {field("place", "Onde você vai começar?", "Ex.: na mesa da sala")}
        {field("obstacle", "O que pode atrapalhar?", "Ex.: pegar o celular")}
        {field(
          "response",
          "Se isso acontecer, o que fará?",
          "Ex.: deixar o celular em outro cômodo",
        )}
      </div>
    </details>
  );
}
