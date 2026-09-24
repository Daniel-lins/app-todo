'use client';

import React, { useState } from 'react';
import { 
  Check, 
  Trash2, 
  Edit3, 
  Pin, 
  Calendar, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  CheckSquare, 
  Square,
  AlertCircle,
  Flame,
} from 'lucide-react';
import { TodoItem } from '../types/todo';
import { CATEGORIES, PRIORITIES } from '../utils/todoConstants';
import { triggerConfetti } from '../utils/confetti';

interface TaskCardProps {
  task: TodoItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onEdit: (task: TodoItem) => void;
  onToggleSubTask: (todoId: string, subTaskId: string) => void;
  onAddSubTask: (todoId: string, title: string) => void;
  onDeleteSubTask: (todoId: string, subTaskId: string) => void;
  onStartPomodoro?: (task: TodoItem) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggle,
  onDelete,
  onPin,
  onEdit,
  onToggleSubTask,
  onAddSubTask,
  onDeleteSubTask,
  onStartPomodoro,
}) => {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [isAddingSub, setIsAddingSub] = useState(false);

  const categoryMeta = CATEGORIES[task.category] || CATEGORIES.other;
  const priorityMeta = PRIORITIES[task.priority] || PRIORITIES.medium;

  const totalSubs = task.subTasks.length;
  const completedSubs = task.subTasks.filter((s) => s.completed).length;
  const subPercent = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

  // Date formatting and overdue calculation
  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = !task.completed && task.dueDate && task.dueDate < todayStr;
  const isToday = !task.completed && task.dueDate === todayStr;

  const handleToggle = () => {
    if (!task.completed) {
      triggerConfetti();
    }
    onToggle(task.id);
  };

  const handleAddSubTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubTaskTitle.trim()) return;
    onAddSubTask(task.id, newSubTaskTitle.trim());
    setNewSubTaskTitle('');
    setIsAddingSub(false);
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`group relative rounded-2xl border transition-all duration-300 cursor-grab active:cursor-grabbing ${
        task.completed
          ? 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200/60 dark:border-zinc-800/50 opacity-75'
          : task.pinned
          ? 'bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-900/50 shadow-md shadow-indigo-500/5'
          : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Pinned accent ribbon indicator */}
      {task.pinned && !task.completed && (
        <div className="absolute top-0 left-6 h-1 w-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-b-full" />
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          {/* Checkbox button */}
          <button
            type="button"
            onClick={handleToggle}
            aria-label={task.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
            className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center transition-all duration-200 ${
              task.completed
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30 scale-95'
                : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-zinc-50/60 dark:bg-zinc-800/60'
            }`}
          >
            {task.completed && <Check className="w-4 h-4 stroke-[3]" />}
          </button>

          {/* Main content body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {/* Category badge */}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${categoryMeta.badgeBg}`}
              >
                {categoryMeta.label}
              </span>

              {/* Priority badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${priorityMeta.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dotColor}`} />
                {priorityMeta.label}
              </span>

              {/* Pomodoros completed badge */}
              {task.pomodoros ? (
                <span
                  title={`${task.pomodoros} ciclos de foco realizados nesta tarefa`}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20"
                >
                  <Flame className="w-3 h-3 fill-rose-500" />
                  <span>{task.pomodoros}</span>
                </span>
              ) : null}

              {/* Due date tag */}
              {task.dueDate && (
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${
                    isOverdue
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold'
                      : isToday
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800'
                  }`}
                >
                  {isOverdue ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Calendar className="w-3 h-3" />
                  )}
                  {isOverdue ? 'Atrasada: ' : isToday ? 'Hoje' : ''}
                  {!isToday && task.dueDate.split('-').reverse().join('/')}
                  {task.dueTime && ` às ${task.dueTime}`}
                </span>
              )}
            </div>

            {/* Title */}
            <h3
              className={`text-base font-semibold leading-snug break-words transition-colors ${
                task.completed
                  ? 'line-through text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {task.title}
            </h3>

            {/* Description */}
            {task.description && (
              <p
                className={`mt-1 text-sm leading-relaxed break-words line-clamp-2 ${
                  task.completed
                    ? 'text-zinc-400/80 dark:text-zinc-600'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {task.description}
              </p>
            )}

            {/* Subtask mini summary progress */}
            {totalSubs > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSubtasks(!showSubtasks)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                >
                  <span>{completedSubs}/{totalSubs} subtarefas</span>
                  {showSubtasks ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                <div className="w-24 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      subPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${subPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Pomodoro Focus Button */}
            {onStartPomodoro && (
              <button
                type="button"
                onClick={() => onStartPomodoro(task)}
                aria-label="Focar com Pomodoro"
                title="Iniciar sessão de Pomodoro nesta tarefa"
                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
              >
                <Flame className="w-4 h-4 fill-rose-500/20" />
              </button>
            )}

            {/* Pin button */}
            <button
              type="button"
              onClick={() => onPin(task.id)}
              aria-label={task.pinned ? 'Desafixar tarefa' : 'Fixar tarefa'}
              className={`p-1.5 rounded-lg transition-colors ${
                task.pinned
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Pin className={`w-4 h-4 ${task.pinned ? 'fill-current rotate-45' : ''}`} />
            </button>

            {/* Edit button */}
            <button
              type="button"
              onClick={() => onEdit(task)}
              aria-label="Editar tarefa"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              aria-label="Excluir tarefa"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subtasks Accordion Panel */}
        {showSubtasks && (
          <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
            <div className="space-y-1.5 pl-9">
              {task.subTasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between group/sub py-1 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onToggleSubTask(task.id, st.id)}
                    className="flex items-center gap-2.5 text-left text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    {st.completed ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                    <span className={st.completed ? 'line-through text-zinc-400 dark:text-zinc-500' : ''}>
                      {st.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSubTask(task.id, st.id)}
                    className="opacity-0 group-hover/sub:opacity-100 p-1 text-zinc-400 hover:text-rose-500 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Add subtask inline input */}
              {isAddingSub ? (
                <form onSubmit={handleAddSubTaskSubmit} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    autoFocus
                    value={newSubTaskTitle}
                    onChange={(e) => setNewSubTaskTitle(e.target.value)}
                    placeholder="Nome da subtarefa..."
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSub(false);
                      setNewSubTaskTitle('');
                    }}
                    className="px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingSub(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar subtarefa
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
