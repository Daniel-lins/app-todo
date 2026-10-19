"use client";

import { useEffect, useState } from "react";
import type { TodoItem } from "../types/todo";
import {
  nextAction,
  withActionEvent,
  actionMetrics,
} from "../utils/actionPlan";
import { addFocusNotice } from "../utils/inAppNotifications";
import { getLocalDateString } from "../utils/dateUtils";
import { planInput } from "./ActionPlanFields";

const button =
  "min-h-11 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50";
const primary =
  "min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2";
const barriers = {
  unclear: {
    label: "Não sei por onde começar",
    help: "Escolha uma ação que você consiga observar: abrir o arquivo, escrever uma frase ou resolver uma questão.",
    example: "Ex.: abrir o arquivo e escrever o primeiro parágrafo",
  },
  large: {
    label: "Parece grande demais",
    help: "Escolha apenas uma pequena parte para esta sessão. Você não precisa terminar tudo agora.",
    example: "Ex.: ler uma página do capítulo",
  },
  perfection: {
    label: "Quero fazer perfeito",
    help: "Experimente um primeiro rascunho. Ele pode ficar incompleto e ser revisado depois.",
    example: "Ex.: escrever três ideias sem revisar",
  },
  energy: {
    label: "Estou sem tempo ou energia",
    help: "Reduza a próxima ação ou edite a tarefa para escolher um horário possível. Pausar também pode ser uma decisão consciente.",
    example: "Ex.: separar o material para amanhã",
  },
  distraction: {
    label: "Estou me distraindo",
    help: "Escolha uma distração para afastar antes de começar e registre como vai lidar com ela.",
    example: "Ex.: silenciar o celular e abrir o material",
  },
} as const;
type Barrier = keyof typeof barriers;
interface ShortSession {
  taskId: string;
  endAt: number;
  minutes: number;
}
function readSession(key: string): ShortSession | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v &&
      typeof v.taskId === "string" &&
      [5, 10, 25].includes(v.minutes) &&
      Number.isFinite(v.endAt) &&
      v.endAt <= Date.now() + 25 * 60_000
      ? v
      : null;
  } catch {
    return null;
  }
}
export function ActionCoach({
  tasks,
  history,
  today,
  scope,
  grouped,
  onUpdate,
  onEdit,
}: {
  tasks: TodoItem[];
  history: TodoItem[];
  today: string;
  scope: string;
  grouped: boolean;
  onUpdate: (id: string, updates: Partial<TodoItem>) => Promise<void>;
  onEdit: (t: TodoItem) => void;
}) {
  const candidates = tasks
    .filter((t) => !t.completed)
    .sort(
      (a, b) =>
        Number(b.actionPlan?.startDate === today) -
          Number(a.actionPlan?.startDate === today) ||
        (a.actionPlan?.startDate || a.dueDate || "9999").localeCompare(
          b.actionPlan?.startDate || b.dueDate || "9999",
        ),
    );
  const [selected, setSelected] = useState("");

  const [barrier, setBarrier] = useState<Barrier | "">("");
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const sessionKey = `apptodo_short_session_v1:${scope}`;
  const [session, setSession] = useState<ShortSession | null>(() =>
    readSession(sessionKey),
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);
  const sessionTask = session
    ? tasks.find((t) => t.id === session.taskId)
    : undefined;
  const task = session
    ? sessionTask && !sessionTask.completed
      ? sessionTask
      : undefined
    : candidates.find((t) => t.id === selected) || candidates[0];
  const remaining = session
    ? Math.max(0, Math.ceil((session.endAt - now) / 1000))
    : 0;
  useEffect(() => {
    if (!session || remaining > 0) return;
    try {
      addFocusNotice(
        scope,
        `short:${session.taskId}:${session.endAt}`,
        "Sessão curta encerrada",
        session.taskId,
      );
    } catch {
      /* Ending a timer must not depend on inbox storage. */
    }
  }, [session, remaining, scope]);
  const metrics = actionMetrics(tasks, today);
  const completedIds = new Set(
    [...new Map([...history, ...tasks].map((t) => [t.id, t])).values()]
      .filter(
        (t) =>
          t.completed &&
          t.completedAt &&
          getLocalDateString(new Date(t.completedAt)) === today,
      )
      .map((t) => t.id),
  );
  const reviewKey = `apptodo_daily_review_v1:${scope}:${today}`;
  const [review, setReview] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(reviewKey) || "{}");
      return {
        progress:
          typeof v.progress === "string" ? v.progress.slice(0, 1000) : "",
        adjustment:
          typeof v.adjustment === "string" ? v.adjustment.slice(0, 1000) : "",
      };
    } catch {
      return { progress: "", adjustment: "" };
    }
  });
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (!task || session) return;
    await run(async () => {
      const value = {
        taskId: task.id,
        endAt: Date.now() + minutes * 60_000,
        minutes,
      };
      // Persist locally first; do not record a start when storage is unavailable.
      localStorage.setItem(sessionKey, JSON.stringify(value));
      try {
        await onUpdate(task.id, {
          actionPlan: withActionEvent(task, "started"),
          status: "in_progress",
        });
      } catch (e) {
        localStorage.removeItem(sessionKey);
        throw e;
      }
      setSelected(task.id);
      setNow(Date.now());
      setSession(value);
      setFeedback(
        "Início registrado. Faça apenas o próximo passo; você pode parar quando precisar.",
      );
    });
  }
  function stop() {
    try {
      localStorage.removeItem(sessionKey);
      setSession(null);
    } catch {
      setError("Não foi possível encerrar a sessão neste dispositivo.");
    }
  }
  return (
    <section
      aria-label="Começar e acompanhar"
      className="mb-6 space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold">Um passo de cada vez</h2>
      {grouped && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Planos e registros de início/avanço desta tarefa são visíveis ao
          grupo.
        </p>
      )}
      {task ? (
        <>
          <label className="block text-sm">
            Em qual tarefa você quer avançar?
            <select
              className={planInput}
              value={task.id}
              disabled={busy || !!session}
              onChange={(e) => {
                setSelected(e.target.value);
                setBarrier("");
                setAction("");
                setNote("");
                setFeedback("");
              }}
            >
              {candidates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <p className="text-base break-words">
            <span className="text-zinc-600 dark:text-zinc-400">
              Próximo passo:{" "}
            </span>
            {nextAction(task)}
          </p>
          {(task.actionPlan?.cue ||
            task.actionPlan?.place ||
            task.actionPlan?.startDate) && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 break-words">
              {[
                task.actionPlan.startDate
                  ? new Date(
                      task.actionPlan.startDate + "T12:00:00",
                    ).toLocaleDateString("pt-BR")
                  : undefined,
                task.actionPlan.startTime,
                task.actionPlan.cue,
                task.actionPlan.place,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {task.actionPlan?.obstacle && (
            <p className="text-sm break-words">
              Se {task.actionPlan.obstacle},{" "}
              {task.actionPlan.response ||
                "defina uma resposta no plano para começar."}
            </p>
          )}
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-sm">
              Sessão curta
              <select
                className={planInput}
                value={minutes}
                disabled={!!session || busy}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {[5, 10, 25].map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={primary}
              disabled={busy || !!session}
              onClick={start}
            >
              Começar por {minutes} minutos
            </button>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => onEdit(task)}
            >
              Editar plano
            </button>
          </div>
          <details className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
            <summary className="cursor-pointer min-h-11 content-center font-medium text-sm">
              Estou adiando
            </summary>
            <div className="space-y-3 pt-2">
              <label className="text-sm block">
                O que está dificultando?
                <select
                  className={planInput}
                  value={barrier}
                  onChange={(e) => {
                    setBarrier(e.target.value as Barrier);
                    setAction("");
                  }}
                >
                  <option value="">Escolha uma dificuldade</option>
                  {Object.entries(barriers).map(([key, v]) => (
                    <option key={key} value={key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              {barrier && (
                <>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {barriers[barrier].help}
                  </p>
                  <label className="block text-sm">
                    Qual será seu próximo passo?
                    <input
                      className={planInput}
                      maxLength={300}
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      placeholder={barriers[barrier].example}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={button}
                      disabled={busy || !action.trim()}
                      onClick={() =>
                        run(async () => {
                          await onUpdate(task.id, {
                            actionPlan: {
                              ...task.actionPlan,
                              nextAction: action.trim(),
                            },
                          });
                          setFeedback(
                            "Próximo passo atualizado. Comece quando estiver pronto.",
                          );
                        })
                      }
                    >
                      Salvar próximo passo
                    </button>
                    <button
                      type="button"
                      className={button}
                      onClick={() => onEdit(task)}
                    >
                      Reagendar ou ajustar o plano
                    </button>
                  </div>
                </>
              )}
            </div>
          </details>
        </>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Nenhuma tarefa pendente. Quando criar uma, você poderá escolher um
          próximo passo aqui.
        </p>
      )}
      {session && (
        <div
          className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3"
          aria-label="Sessão curta em andamento"
        >
          <p className="font-medium break-words">
            {sessionTask?.title || "Tarefa removida ou indisponível"}
          </p>
          <p
            className="text-2xl font-semibold tabular-nums"
            role="timer"
            aria-label="Tempo restante"
          >
            {Math.floor(remaining / 60)
              .toString()
              .padStart(2, "0")}
            :{(remaining % 60).toString().padStart(2, "0")}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {remaining
              ? "Pode parar antes. O tempo não comprova conclusão e não gera XP."
              : "O tempo terminou. Você decide se avançou, continua ou encerra."}
          </p>
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={stop}
          >
            Encerrar sessão
          </button>
        </div>
      )}
      {task && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
          <label className="block text-sm">
            O que você conseguiu avançar?
            <input
              className={planInput}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: resolvi duas questões; falta revisar uma"
            />
          </label>
          <button
            type="button"
            className={button}
            disabled={busy || !note.trim()}
            onClick={() =>
              run(async () => {
                await onUpdate(task.id, {
                  actionPlan: withActionEvent(task, "advanced", note),
                });
                setNote("");
                setFeedback(
                  "Avanço registrado. A tarefa continua pendente até você concluí-la.",
                );
              })
            }
          >
            Registrar avanço
          </button>
        </div>
      )}
      <details className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
        <summary className="cursor-pointer min-h-11 content-center font-medium text-sm">
          Revisar meu dia
        </summary>
        <div className="space-y-3 pt-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {metrics.planned} com início planejado hoje · {metrics.started}{" "}
            iniciadas · {metrics.advanced} com avanço registrado ·{" "}
            {completedIds.size} concluídas. Contagem por tarefa, incluindo
            registros do grupo neste espaço; início e avanço são autorrelatos.
          </p>
          <label className="text-sm block">
            O que avançou e o que ficou pendente?
            <textarea
              className={planInput}
              rows={3}
              maxLength={1000}
              value={review.progress}
              onChange={(e) =>
                setReview({ ...review, progress: e.target.value })
              }
            />
          </label>
          <label className="text-sm block">
            Qual ajuste fará no próximo dia?
            <textarea
              className={planInput}
              rows={2}
              maxLength={1000}
              value={review.adjustment}
              onChange={(e) =>
                setReview({ ...review, adjustment: e.target.value })
              }
            />
          </label>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            A reflexão é privada neste navegador e separada por conta e espaço.
            Não sincroniza nem entra no backup de tarefas.
          </p>
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() =>
              run(async () => {
                localStorage.setItem(reviewKey, JSON.stringify(review));
                setFeedback("Reflexão salva neste navegador.");
              })
            }
          >
            Salvar reflexão
          </button>
          <details>
            <summary className="cursor-pointer min-h-11 content-center text-sm">
              Registros de início e avanço
            </summary>
            <ul className="space-y-2 text-sm">
              {tasks
                .flatMap((t) =>
                  (t.actionPlan?.events || []).map((e) => ({
                    ...e,
                    title: t.title,
                  })),
                )
                .sort((a, b) => b.at.localeCompare(a.at))
                .slice(0, 20)
                .map((e) => (
                  <li
                    key={e.id}
                    className="border-t border-zinc-100 dark:border-zinc-800 pt-2 break-words"
                  >
                    {new Date(e.at).toLocaleString("pt-BR")} · {e.title} ·{" "}
                    {e.kind === "started"
                      ? "Início registrado"
                      : e.note || "Avanço registrado"}
                  </li>
                ))}
            </ul>
          </details>
        </div>
      </details>
      {error && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {feedback && (
        <p
          role="status"
          className="text-sm text-indigo-700 dark:text-indigo-300"
        >
          {feedback}
        </p>
      )}
    </section>
  );
}
