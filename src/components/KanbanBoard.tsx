'use client';

import React, { useState } from 'react';
import { 
  Circle, 
  Clock, 
  CheckCircle2, 
  Flame, 
  Calendar, 
  Pin, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Play, 
  ChevronRight, 
  ChevronLeft,
  GripVertical
} from 'lucide-react';
import { TodoItem, TaskStatus } from '../types/todo';
import { CATEGORIES, PRIORITIES } from '../utils/todoConstants';
import { triggerConfetti } from '../utils/confetti';

interface KanbanBoardProps {
  todos: TodoItem[];
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onEditTask: (task: TodoItem) => void;
  onDeleteTask: (taskId: string) => void;
  onTogglePin: (taskId: string) => void;
  onStartPomodoro: (task: TodoItem) => void;
}

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  bgLightClass: string;
  badgeClass: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'todo',
    title: 'A Fazer',
    icon: <Circle className="w-4 h-4 text-amber-500" />,
    colorClass: 'border-amber-500/30 dark:border-amber-500/20',
    bgLightClass: 'bg-amber-500/5',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  {
    id: 'in_progress',
    title: 'Em Andamento',
    icon: <Clock className="w-4 h-4 text-blue-500" />,
    colorClass: 'border-blue-500/30 dark:border-blue-500/20',
    bgLightClass: 'bg-blue-500/5',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  {
    id: 'completed',
    title: 'Concluídas',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    colorClass: 'border-emerald-500/30 dark:border-emerald-500/20',
    bgLightClass: 'bg-emerald-500/5',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  todos,
  onMoveTask,
  onEditTask,
  onDeleteTask,
  onTogglePin,
  onStartPomodoro,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Group tasks by status
  const getTasksForColumn = (status: TaskStatus) => {
    return todos.filter((t) => {
      if (status === 'completed') {
        return t.completed || t.status === 'completed';
      }
      if (status === 'in_progress') {
        return !t.completed && t.status === 'in_progress';
      }
      // 'todo' column
      return !t.completed && (t.status === 'todo' || !t.status);
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      if (status === 'completed') {
        triggerConfetti();
      }
      onMoveTask(taskId, status);
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
      {COLUMNS.map((col) => {
        const columnTasks = getTasksForColumn(col.id);
        const isColumnOver = dragOverColumn === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`flex flex-col rounded-3xl border transition-all duration-200 min-h-[480px] bg-zinc-50/60 dark:bg-zinc-900/40 p-4 ${
              isColumnOver
                ? 'border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/20 scale-[1.01]'
                : col.colorClass
            }`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-center gap-2">
                {col.icon}
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  {col.title}
                </h3>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${col.badgeClass}`}>
                {columnTasks.length}
              </span>
            </div>

            {/* Task list in column */}
            <div className="flex-1 space-y-3">
              {columnTasks.length === 0 ? (
                <div className="h-36 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-xs text-zinc-400 font-medium">
                  Solte uma tarefa aqui
                </div>
              ) : (
                columnTasks.map((task) => {
                  const cat = CATEGORIES[task.category] || CATEGORIES.other;
                  const prio = PRIORITIES[task.priority] || PRIORITIES.medium;
                  const isBeingDragged = draggedTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      className={`group relative rounded-2xl border bg-white dark:bg-zinc-900 p-3.5 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                        isBeingDragged ? 'opacity-40 scale-95' : 'opacity-100'
                      } ${
                        task.pinned
                          ? 'border-indigo-300 dark:border-indigo-800'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {/* Top badges & Drag handle */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Priority badge */}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${prio.badgeClass}`}>
                            {prio.label}
                          </span>
                          {/* Category badge */}
                          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                            {cat.label}
                          </span>
                          {task.pinned && (
                            <Pin className="w-3 h-3 text-indigo-500 fill-indigo-500" />
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Pomodoro quick trigger */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartPomodoro(task);
                            }}
                            title="Focar com Pomodoro"
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                          >
                            <Flame className="w-3.5 h-3.5 fill-rose-500" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTask(task);
                            }}
                            title="Editar tarefa"
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTask(task.id);
                            }}
                            title="Excluir tarefa"
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className={`text-sm font-semibold text-zinc-800 dark:text-zinc-200 leading-snug line-clamp-2 ${
                        task.completed ? 'line-through text-zinc-400 dark:text-zinc-500' : ''
                      }`}>
                        {task.title}
                      </h4>

                      {/* Description snippet if any */}
                      {task.description && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2 mt-1">
                          {task.description}
                        </p>
                      )}

                      {/* Bottom row (due date, subtasks, pomodoro badge, quick shift arrows) */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400">
                        <div className="flex items-center gap-2">
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{task.dueDate}</span>
                            </div>
                          )}

                          {task.pomodoros ? (
                            <div className="flex items-center gap-0.5 text-rose-500 font-semibold">
                              <Flame className="w-3 h-3 fill-rose-500" />
                              <span>{task.pomodoros}</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Quick move buttons (accessible for mobile / clicking) */}
                        <div className="flex items-center gap-1">
                          {col.id !== 'todo' && (
                            <button
                              type="button"
                              onClick={() => onMoveTask(task.id, col.id === 'completed' ? 'in_progress' : 'todo')}
                              title="Mover para esquerda"
                              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {col.id !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = col.id === 'todo' ? 'in_progress' : 'completed';
                                if (next === 'completed') triggerConfetti();
                                onMoveTask(task.id, next);
                              }}
                              title="Mover para direita"
                              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
