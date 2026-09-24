export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Category = 'work' | 'personal' | 'study' | 'health' | 'finance' | 'other';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export type ViewMode = 'list' | 'kanban';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  status?: TaskStatus;
  priority: Priority;
  category: Category;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  subTasks: SubTask[];
  pinned: boolean;
  createdAt: string;
  completedAt?: string;
  pomodoros?: number;
  order?: number;
}

export type FilterStatus = 'all' | 'active' | 'completed' | 'pinned' | 'today';

export type SortOption = 'createdAt_desc' | 'createdAt_asc' | 'dueDate_asc' | 'dueDate_desc' | 'priority_desc' | 'alphabetical';

