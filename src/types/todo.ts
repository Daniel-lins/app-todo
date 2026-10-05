export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Category = 'work' | 'personal' | 'study' | 'health' | 'finance' | 'other';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export type ViewMode = 'list' | 'kanban';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  notes?: string;
  dueDate?: string;
  completedBy?: string;
  completedAt?: string;
}

export type TaskSyncState = 'synced' | 'syncing' | 'local_only' | 'error';
export type AppSyncStatus = 'synced' | 'syncing' | 'local_only' | 'error';

export interface TodoItem {
  id: string;
  kind?: 'task' | 'mission';
  recurrence?: 'daily' | 'weekly' | 'monthly';
  recurrenceSeriesId?: string;
  recurrenceAnchorDay?: number;
  assignedTo?: string;
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
  pomodoroSessionIds?: string[];
  order?: number;
  groupId?: string;
  createdByName?: string;
  syncState?: TaskSyncState;
  syncError?: string;
  updatedAt?: string;
}

export type FilterStatus = 'all' | 'active' | 'completed' | 'pinned' | 'today' | 'missions' | 'week' | 'achievements';

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
  displayName?: string;
  email?: string;
}

export interface TaskStats {
  total: number;
  completed: number;
  active: number;
  pinned: number;
  urgent: number;
  rate: number;
  todayTotal: number;
  todayCompleted: number;
  todayPending: number;
  todayCount: number;
  overdue: number;
}

export interface RpgAttribute {
  id: Category;
  name: string;
  areaName: string;
  description: string;
  iconName: string;
  color: string;
  badgeBg: string;
  xp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
}

export interface RpgBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category?: Category;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: { current: number; total: number };
}

export interface RpgStats {
  totalXp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  title: string;
  attributes: Record<Category, RpgAttribute>;
  badges: RpgBadge[];
  tasksCompletedCount: number;
  pomodoroFocusMinutes: number;
}



