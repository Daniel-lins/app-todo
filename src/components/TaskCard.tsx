'use client';

import React, { useState } from 'react';
import { 
  Check, 
  Trash2, 
  Edit3, 
  Pin, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  CheckSquare, 
  Square,
  AlertCircle,
  Flame,
  CloudOff,
  Loader2,
  MoreHorizontal,
  Flag,
  Briefcase,
  User,
  BookOpen,
  Heart,
  DollarSign,
  Folder,
  Users,
} from 'lucide-react';
import { TodoItem, TaskStatus, Category } from '../types/todo';
import { CATEGORIES, PRIORITIES } from '../utils/todoConstants';
import { triggerConfetti } from '../utils/confetti';
import { isTodayLocal, isOverdueLocal } from '../utils/dateUtils';

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
  onMoveTask?: (taskId: string, newStatus: TaskStatus) => void;
  isPomodoroActiveTask?: boolean;
  groupName?: string;
}

const getCategoryIcon = (category: Category) => {
  switch (category) {
    case 'work':
      return <Briefcase className="w-3.5 h-3.5" />;
    case 'personal':
      return <User className="w-3.5 h-3.5" />;
    case 'study':
      return <BookOpen className="w-3.5 h-3.5" />;
    case 'health':
      return <Heart className="w-3.5 h-3.5" />;
    case 'finance':
      return <DollarSign className="w-3.5 h-3.5" />;
    default:
      return <Folder className="w-3.5 h-3.5" />;
  }
};

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
  onMoveTask,
  isPomodoroActiveTask = false,
  groupName,
}) => {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const categoryMeta = CATEGORIES[task.category] || CATEGORIES.other;
  const priorityMeta = PRIORITIES[task.priority] || PRIORITIES.medium;

  const totalSubs = task.subTasks.length;
  const completedSubs = task.subTasks.filter((s) => s.completed).length;

  // Date formatting and overdue calculation (fuso horário local)
  const isOverdue = !task.completed && isOverdueLocal(task.dueDate);
  const isToday = !task.completed && isTodayLocal(task.dueDate);

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

  // Render priority flag according to visual mockup
  const renderPriority = () => {
    if (!task.priority || task.completed) return null;

    if (task.priority === 'urgent' || task.priority === 'high') {
      return (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400"
          title={`Prioridade ${priorityMeta.label}`}
        >
          <Flag className="w-3.5 h-3.5 fill-orange-500 text-orange-600 dark:text-orange-400" />
          <span>{priorityMeta.label}</span>
        </span>
      );
    }

    if (task.priority === 'medium') {
      return (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400"
          title={`Prioridade ${priorityMeta.label}`}
        >
          <Flag className="w-3.5 h-3.5 fill-zinc-400 text-zinc-500 dark:text-zinc-400" />
          <span>{priorityMeta.label}</span>
        </span>
      );
    }

    return null;
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`group relative py-3.5 px-3 sm:px-4 border-b border-zinc-100 dark:border-zinc-800/80 transition-all duration-150 cursor-grab active:cursor-grabbing hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 ${
        isPomodoroActiveTask
          ? 'border-l-[3.5px] border-l-[#5b4fe9] bg-[#5b4fe9]/[0.03] dark:bg-[#5b4fe9]/[0.06]'
          : ''
      } ${task.completed ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start gap-3.5">
        {/* Checkbox circular */}
        <button
          type="button"
          role="checkbox"
          aria-checked={task.completed}
          onClick={handleToggle}
          aria-label={task.completed ? `Marcar "${task.title}" como pendente` : `Marcar "${task.title}" como concluída`}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5b4fe9] focus:ring-offset-2 ${
            task.completed
              ? 'bg-[#5b4fe9] text-white shadow-sm shadow-[#5b4fe9]/30'
              : 'border-[1.5px] border-zinc-300 dark:border-zinc-600 hover:border-[#5b4fe9] dark:hover:border-[#5b4fe9] bg-white dark:bg-zinc-900'
          }`}
        >
          {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-start justify-between gap-3">
            <h3
              className={`text-[15px] sm:text-base font-semibold leading-snug break-words transition-colors ${
                task.completed
                  ? 'line-through text-zinc-400 dark:text-zinc-500 font-normal'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {task.pinned && !task.completed && (
                <Pin className="inline-block w-3.5 h-3.5 mr-1.5 text-[#5b4fe9] fill-[#5b4fe9] rotate-45 -mt-0.5" />
              )}
              {task.title}
            </h3>

            {/* Right side items: Priority flag + 3-dots menu button */}
            <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
              {renderPriority()}

              {/* 3-dots Menu Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  aria-expanded={isMenuOpen}
                  aria-label={`Mais opções da tarefa "${task.title}"`}
                  className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[#5b4fe9]"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {isMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsMenuOpen(false)} 
                    />
                    <div 
                      role="menu"
                      aria-label="Ações da tarefa"
                      className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-40 p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                    >
                      {/* Pomodoro */}
                      {onStartPomodoro && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onStartPomodoro(task);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-left transition-colors"
                        >
                          <Flame className="w-3.5 h-3.5 fill-rose-500/20" />
                          <span>Focar com Pomodoro</span>
                        </button>
                      )}

                      {/* Pin */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onPin(task.id);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-left transition-colors"
                      >
                        <Pin className={`w-3.5 h-3.5 ${task.pinned ? 'fill-[#5b4fe9] text-[#5b4fe9]' : ''}`} />
                        <span>{task.pinned ? 'Desafixar tarefa' : 'Fixar tarefa'}</span>
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onEdit(task);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-left transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar tarefa</span>
                      </button>

                      {/* Move status */}
                      {onMoveTask && (
                        <div className="px-3 py-1.5 border-t border-zinc-100 dark:border-zinc-800 my-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                            Status
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsMenuOpen(false);
                                onMoveTask(task.id, 'todo');
                              }}
                              className={`flex-1 text-[11px] py-1 rounded text-center transition-colors ${
                                task.status === 'todo' || (!task.status && !task.completed)
                                  ? 'bg-[#5b4fe9] text-white font-medium'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              A Fazer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsMenuOpen(false);
                                onMoveTask(task.id, 'in_progress');
                              }}
                              className={`flex-1 text-[11px] py-1 rounded text-center transition-colors ${
                                task.status === 'in_progress'
                                  ? 'bg-[#5b4fe9] text-white font-medium'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              Andamento
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsMenuOpen(false);
                                if (!task.completed) triggerConfetti();
                                onMoveTask(task.id, 'completed');
                              }}
                              className={`flex-1 text-[11px] py-1 rounded text-center transition-colors ${
                                task.status === 'completed' || task.completed
                                  ? 'bg-[#5b4fe9] text-white font-medium'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              Concluída
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onDelete(task.id);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-left transition-colors border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir tarefa</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Optional description */}
          {task.description && (
            <p
              className={`mt-1 text-xs sm:text-sm leading-relaxed break-words line-clamp-2 ${
                task.completed
                  ? 'text-zinc-400/80 dark:text-zinc-600'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {task.description}
            </p>
          )}

          {/* Metadata line: Category / Group • Due date • Subtasks • Sync */}
          <div className="mt-1.5 flex items-center gap-2.5 flex-wrap text-xs text-zinc-500 dark:text-zinc-400">
            {/* Group or Category */}
            {groupName ? (
              <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>{groupName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium">
                {getCategoryIcon(task.category)}
                <span>{categoryMeta.label}</span>
              </span>
            )}

            {/* Due date tag */}
            {task.dueDate && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    isOverdue
                      ? 'text-rose-600 dark:text-rose-400 font-semibold'
                      : isToday
                      ? 'text-zinc-700 dark:text-zinc-200 font-medium'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {isOverdue ? 'Atrasada: ' : isToday ? 'Hoje' : ''}
                    {!isToday && task.dueDate.split('-').reverse().join('/')}
                    {task.dueTime && `, ${task.dueTime}`}
                  </span>
                </span>
              </>
            )}

            {/* Subtasks progress count */}
            {totalSubs > 0 && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <button
                  type="button"
                  onClick={() => setShowSubtasks(!showSubtasks)}
                  aria-expanded={showSubtasks}
                  aria-controls={`subtasks-list-${task.id}`}
                  className="inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{completedSubs}/{totalSubs} subtarefas</span>
                  {showSubtasks ? (
                    <ChevronUp className="w-3 h-3 ml-0.5" />
                  ) : (
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  )}
                </button>
              </>
            )}

            {/* Pomodoro count */}
            {task.pomodoros ? (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <span
                  title={`${task.pomodoros} ciclos de foco`}
                  className="inline-flex items-center gap-1 text-rose-500 font-medium"
                >
                  <Flame className="w-3.5 h-3.5 fill-rose-500/20" />
                  <span>{task.pomodoros}</span>
                </span>
              </>
            ) : null}

            {/* Sync status indicator */}
            {task.syncState === 'error' ? (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <span
                  title={task.syncError || 'Alteração não sincronizada com a nuvem'}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium"
                >
                  <AlertCircle className="w-3 h-3" />
                  <span>Não sincronizado</span>
                </span>
              </>
            ) : task.syncState === 'local_only' ? (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <span
                  title="Salvo localmente no dispositivo (offline)"
                  className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium"
                >
                  <CloudOff className="w-3 h-3" />
                  <span>Salvo localmente</span>
                </span>
              </>
            ) : task.syncState === 'syncing' ? (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <span
                  title="Sincronizando com a nuvem..."
                  className="inline-flex items-center gap-1 text-[11px] text-[#5b4fe9] font-medium"
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Sincronizando</span>
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Subtasks Accordion Panel */}
      {showSubtasks && (
        <div id={`subtasks-list-${task.id}`} className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1.5 pl-8">
          {task.subTasks.map((st) => (
            <div
              key={st.id}
              className="flex items-center justify-between group/sub py-1 px-2 rounded-lg hover:bg-zinc-100/60 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={st.completed}
                onClick={() => onToggleSubTask(task.id, st.id)}
                aria-label={st.completed ? `Marcar subtarefa "${st.title}" como pendente` : `Marcar subtarefa "${st.title}" como concluída`}
                className="flex items-center gap-2.5 text-left text-xs text-zinc-700 dark:text-zinc-300"
              >
                {st.completed ? (
                  <CheckSquare className="w-3.5 h-3.5 text-[#5b4fe9]" />
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
                aria-label={`Excluir subtarefa "${st.title}"`}
                className="opacity-0 group-hover/sub:opacity-100 group-focus-within/sub:opacity-100 focus:opacity-100 p-1 text-zinc-400 hover:text-rose-500 transition-opacity"
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
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#5b4fe9] text-zinc-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#5b4fe9] text-white hover:bg-[#4d40d9]"
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
              className="inline-flex items-center gap-1.5 text-xs text-[#5b4fe9] hover:underline pt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar subtarefa
            </button>
          )}
        </div>
      )}
    </div>
  );
};
