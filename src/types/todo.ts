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
  groupId?: string;
  createdByName?: string;
}

export type FilterStatus = 'all' | 'active' | 'completed' | 'pinned' | 'today';

export type SortOption = 'createdAt_desc' | 'createdAt_asc' | 'dueDate_asc' | 'dueDate_desc' | 'priority_desc' | 'alphabetical';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  focusMinutes?: number;
  completedTasksCount?: number;
  updatedAt?: string;
}

export interface TaskGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  role?: 'owner' | 'member';
  memberCount?: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: string;
  profile?: UserProfile;
}


