"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Calendar,
  Clock,
  Pin,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import {
  TodoItem,
  Priority,
  Category,
  SubTask,
  GroupMember,
} from "../types/todo";
import { CATEGORIES, PRIORITIES } from "../utils/todoConstants";
import { TaskDiscussion } from "./TaskDiscussion";
import { TaskStepsEditor } from "./TaskStepsEditor";
import { useAccessibleModal } from "../hooks/useAccessibleModal";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    taskData: Omit<
      TodoItem,
      "id" | "completed" | "createdAt" | "order" | "pomodoros"
    >,
  ) => Promise<void> | void;
  initialData?: TodoItem | null;
  userId?: string;
  members?: GroupMember[];
  initialKind?: TodoItem["kind"];
}

const TaskModalContent: React.FC<TaskModalProps> = ({
  onClose,
  onSubmit,
  initialData,
  initialKind = "task",
  userId,
  members = [],
}) => {
  const [kind, setKind] = useState<"task" | "mission">(
    initialData?.kind || initialKind,
  );
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [priority, setPriority] = useState<Priority>(
    initialData?.priority || "medium",
  );
  const [category, setCategory] = useState<Category>(
    initialData?.category || "other",
  );
  const [dueDate, setDueDate] = useState(initialData?.dueDate || "");
  const [dueTime, setDueTime] = useState(initialData?.dueTime || "");
  const [pinned, setPinned] = useState(initialData?.pinned || false);
  const [subTasks, setSubTasks] = useState<SubTask[]>(
    initialData?.subTasks || [],
  );
  const [assignedTo, setAssignedTo] = useState(initialData?.assignedTo || "");
  const [recurrence, setRecurrence] = useState<TodoItem["recurrence"]>(
    initialData?.recurrence,
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState<boolean>(
    Boolean(
      initialKind === "mission" ||
        initialData?.kind === "mission" ||
        initialData?.description ||
        initialData?.dueDate ||
        initialData?.dueTime ||
        (initialData?.priority && initialData.priority !== "medium") ||
        (initialData?.category && initialData.category !== "other") ||
        (initialData?.subTasks && initialData.subTasks.length > 0) ||
        initialData?.pinned,
    ),
  );

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Hook de acessibilidade: contenção de foco, foco inicial e devolução ao fechar
  const { modalRef } = useAccessibleModal({
    isOpen: true,
    onClose,
    initialFocusRef: titleInputRef,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Por favor, informe o título da tarefa.");
      return;
    }

    if (kind === "mission" && !subTasks.length) {
      setShowOptionalDetails(true);
      setError("Adicione pelo menos uma etapa à missão grande.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await onSubmit({
        title: title.trim(),
        kind,
        recurrence: kind === "task" ? recurrence : undefined,
        assignedTo: assignedTo || undefined,
        description: description.trim() ? description.trim() : "",
        priority,
        category,
        dueDate: dueDate ? dueDate : "",
        dueTime: dueTime ? dueTime : "",
        pinned,
        subTasks: subTasks.map((s) => ({ ...s, title: s.title.trim() })),
      });
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Falha ao salvar a tarefa.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2
            id="task-modal-title"
            className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
          >
            {initialData?.id
              ? "Editar tarefa ou missão"
              : kind === "mission"
                ? "Nova missão grande"
                : "Nova tarefa"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de tarefa"
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form with scrollable body and sticky footer */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Title - Fast Capture Primary Input */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                O que você quer criar?
              </legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-800 dark:text-zinc-200">
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="task-kind"
                    checked={kind === "task"}
                    onChange={() => setKind("task")}
                  />
                  Tarefa do dia a dia
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="task-kind"
                    checked={kind === "mission"}
                    onChange={() => {
                      setKind("mission");
                      setShowOptionalDetails(true);
                    }}
                  />
                  Missão grande
                </label>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {kind === "mission"
                  ? "Um objetivo com etapas. Ao concluí-lo, ele entra nas suas conquistas."
                  : "Uma atividade normal. Ela gera XP, mas não vira uma conquista."}
              </p>
            </fieldset>
            <div>
              <label
                htmlFor="task-title-input"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
              >
                {kind === "mission" ? "Nome da missão *" : "Título da tarefa *"}
              </label>
              <input
                id="task-title-input"
                ref={titleInputRef}
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError("");
                }}
                placeholder={
                  kind === "mission"
                    ? "Ex: Ler dez livros ou tirar CNH"
                    : "Ex: Concluir relatório trimestral..."
                }
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-sm font-medium transition-all"
              />
            </div>

            {kind === "mission" && (
              <TaskStepsEditor steps={subTasks} onChange={setSubTasks} />
            )}

            {/* Toggle Optional Details Button */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                aria-expanded={showOptionalDetails}
                aria-controls="task-modal-optional-details"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors py-1 min-h-[32px]"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>
                  {showOptionalDetails
                    ? "Ocultar campos opcionais"
                    : "+ Adicionar detalhes (descrição, categoria, prazo, etapas)"}
                </span>
                {showOptionalDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Optional Details Collapsible Section */}
            {showOptionalDetails && (
              <div
                id="task-modal-optional-details"
                className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 animate-in fade-in duration-200"
              >
                {/* Description */}
                <div>
                  <label
                    htmlFor="task-description-input"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
                  >
                    Descrição / Notas
                  </label>
                  <textarea
                    id="task-description-input"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Adicione mais detalhes, links ou observações importantes..."
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-sm transition-all resize-none"
                  />
                </div>

                {/* Category Selector */}
                <div>
                  <label
                    id="task-category-heading"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
                  >
                    Categoria
                  </label>
                  <div
                    role="group"
                    aria-labelledby="task-category-heading"
                    className="grid grid-cols-3 sm:grid-cols-6 gap-2"
                  >
                    {(Object.keys(CATEGORIES) as Category[]).map((catKey) => {
                      const cat = CATEGORIES[catKey];
                      const isSelected = category === catKey;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setCategory(catKey)}
                          aria-pressed={isSelected}
                          className={`px-2 py-2 rounded-xl text-xs font-medium border text-center transition-all min-h-11 ${
                            isSelected
                              ? `${cat.bgColor} ${cat.borderColor} ${cat.color} font-bold shadow-sm ring-1 ring-indigo-500/30`
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Selector */}
                <div>
                  <label
                    id="task-priority-heading"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
                  >
                    Prioridade
                  </label>
                  <div
                    role="group"
                    aria-labelledby="task-priority-heading"
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                  >
                    {(Object.keys(PRIORITIES) as Priority[]).map((pKey) => {
                      const p = PRIORITIES[pKey];
                      const isSelected = priority === pKey;
                      return (
                        <button
                          key={pKey}
                          type="button"
                          onClick={() => setPriority(pKey)}
                          aria-pressed={isSelected}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all min-h-11 ${
                            isSelected
                              ? `${p.badgeClass} ring-1 ring-indigo-500/40 shadow-sm`
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${p.dotColor}`}
                          />
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Due Date and Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="task-due-date-input"
                      className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
                    >
                      Data Limite
                    </label>
                    <div className="relative">
                      <input
                        id="task-due-date-input"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[40px]"
                      />
                      <Calendar className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="task-due-time-input"
                      className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
                    >
                      Horário (Opcional)
                    </label>
                    <div className="relative">
                      <input
                        id="task-due-time-input"
                        type="time"
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[40px]"
                      />
                      <Clock className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {kind === "task" && (
                  <TaskStepsEditor steps={subTasks} onChange={setSubTasks} />
                )}
                {kind === "task" && (
                  <label className="block text-sm font-medium">
                    Repetição
                    <select
                      aria-label="Repetição"
                      className="w-full min-h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 mt-2"
                      value={recurrence || ""}
                      onChange={(e) =>
                        setRecurrence(
                          (e.target.value as TodoItem["recurrence"]) ||
                            undefined,
                        )
                      }
                    >
                      <option value="">Não repetir</option>
                      <option value="daily">Diariamente</option>
                      <option value="weekly">Semanalmente</option>
                      <option value="monthly">Mensalmente</option>
                    </select>
                    <span className="block text-xs text-zinc-500 mt-2">
                      Ao concluir, uma nova tarefa será criada para o próximo
                      prazo.
                    </span>
                  </label>
                )}

                {members.length > 0 && (
                  <label className="block text-sm font-medium">
                    Responsável
                    <select
                      aria-label="Responsável"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="mt-2 w-full min-h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3"
                    >
                      <option value="">Sem responsável</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName || m.profile?.displayName || "Membro"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {/* Pin toggle */}
                <div className="pt-1">
                  <label
                    htmlFor="task-pinned-checkbox"
                    className="flex items-center gap-3 cursor-pointer select-none"
                  >
                    <input
                      id="task-pinned-checkbox"
                      type="checkbox"
                      checked={pinned}
                      onChange={(e) => setPinned(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700"
                    />
                    <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Pin className="w-4 h-4 text-indigo-500" />
                      Fixar esta tarefa com destaque no topo
                    </span>
                  </label>
                </div>
              </div>
            )}
            {initialData?.id && initialData.groupId && userId && (
              <TaskDiscussion
                taskId={initialData.id}
                userId={userId}
                members={members}
              />
            )}
          </div>

          {/* Sticky Footer actions - Always accessible without scrolling */}
          <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 px-5 sm:px-6 py-3.5 flex items-center justify-end gap-3 z-10 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-11"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#5b4fe9] hover:bg-[#4d40d9] text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all duration-200 disabled:opacity-50 min-h-11"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {initialData?.id
                  ? "Salvar alterações"
                  : kind === "mission"
                    ? "Criar missão grande"
                    : "Criar tarefa"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  initialKind,
  userId,
  members,
}) => {
  if (!isOpen) return null;
  return (
    <TaskModalContent
      key={
        initialData?.id
          ? `edit-${initialData.id}`
          : `new-${initialData?.title || "empty"}`
      }
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      initialData={initialData}
      initialKind={initialKind}
      userId={userId}
      members={members}
    />
  );
};
