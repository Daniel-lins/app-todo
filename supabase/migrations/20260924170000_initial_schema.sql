-- Bootstrap for a new Supabase project. Existing tables are left intact.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text, display_name text, avatar_url text DEFAULT 'rocket',
  focus_minutes integer NOT NULL DEFAULT 0, completed_tasks_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  description text, color text NOT NULL DEFAULT '#5b4fe9',
  invite_code text NOT NULL UNIQUE, created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE (group_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.tasks (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL, description text, completed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'todo', priority text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'other', due_date date, due_time time,
  pinned boolean NOT NULL DEFAULT false, pomodoros integer NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0, created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.subtasks (
  id text PRIMARY KEY, task_id text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL, completed boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS tasks_user_group_idx ON public.tasks(user_id, group_id);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS subtasks_task_idx ON public.subtasks(task_id);
