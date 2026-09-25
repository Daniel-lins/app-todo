BEGIN;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS pomodoro_session_ids text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- Replace legacy policies, including permissive policies with nonstandard names.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('profiles','groups','group_members','tasks','subtasks')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;

CREATE POLICY profiles_own ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY groups_select ON public.groups FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR id IN (SELECT public.get_my_group_ids()));
CREATE POLICY groups_insert ON public.groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY groups_update ON public.groups FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY groups_delete ON public.groups FOR DELETE TO authenticated USING (created_by = auth.uid());
CREATE POLICY members_select ON public.group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR group_id IN (SELECT public.get_my_group_ids()));
-- Joining is exclusively through the invite RPC; neither a guessed group UUID nor
-- a direct INSERT can grant membership or elevate a member to owner.
CREATE POLICY members_delete ON public.group_members FOR DELETE TO authenticated
  USING (role = 'member' AND (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid()
  )));
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (
  (group_id IS NULL AND user_id = auth.uid()) OR group_id IN (SELECT public.get_my_group_ids())
);
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND (group_id IS NULL OR group_id IN (SELECT public.get_my_group_ids()))
);
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING (
  (group_id IS NULL AND user_id = auth.uid()) OR group_id IN (SELECT public.get_my_group_ids())
) WITH CHECK (
  (group_id IS NULL AND user_id = auth.uid()) OR group_id IN (SELECT public.get_my_group_ids())
);
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING (
  (group_id IS NULL AND user_id = auth.uid()) OR group_id IN (SELECT public.get_my_group_ids())
);
CREATE POLICY subtasks_access ON public.subtasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));

CREATE OR REPLACE FUNCTION public.protect_task_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'A autoria e o espaço de uma tarefa não podem ser alterados.';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_task_identity ON public.tasks;
CREATE TRIGGER protect_task_identity BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.protect_task_identity();

-- SECURITY INVOKER is intentional: every row operation remains subject to RLS.
-- jsonb_populate_record also supports existing projects whose task IDs are UUIDs.
CREATE OR REPLACE FUNCTION public.apply_task_changes(p_group_id uuid, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE change jsonb; incoming public.tasks%ROWTYPE; existing public.tasks%ROWTYPE; sub jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.'; END IF;
  IF jsonb_typeof(p_changes) <> 'array' THEN RAISE EXCEPTION 'Alterações inválidas.'; END IF;
  IF p_group_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.get_my_group_ids() AS g(id) WHERE id = p_group_id)
    THEN RAISE EXCEPTION 'Sem acesso ao grupo.'; END IF;
  -- Serialize writers for this user and space; group writers share the same lock.
  PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(p_group_id::text, auth.uid()::text), 0));
  FOR change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    IF change->>'action' = 'delete' THEN
      DELETE FROM public.tasks WHERE id::text = change->>'id'
        AND group_id IS NOT DISTINCT FROM p_group_id
        AND (p_group_id IS NOT NULL OR user_id = auth.uid());
    ELSIF change->>'action' = 'upsert' THEN
      incoming := jsonb_populate_record(NULL::public.tasks, change->'task');
      IF incoming.id::text IS DISTINCT FROM change->>'id' OR incoming.title IS NULL
        OR incoming.group_id IS DISTINCT FROM p_group_id OR incoming.user_id IS DISTINCT FROM auth.uid()
        THEN RAISE EXCEPTION 'Tarefa ou espaço inválido.'; END IF;
      SELECT * INTO existing FROM public.tasks WHERE id = incoming.id;
      IF FOUND THEN
        IF existing.group_id IS DISTINCT FROM p_group_id THEN RAISE EXCEPTION 'A tarefa pertence a outro espaço.'; END IF;
        UPDATE public.tasks SET title=incoming.title, description=incoming.description,
          completed=incoming.completed, status=incoming.status, priority=incoming.priority,
          category=incoming.category, due_date=incoming.due_date, due_time=incoming.due_time,
          pinned=incoming.pinned,
          pomodoros=greatest(incoming.pomodoros, existing.pomodoros + (SELECT count(*) FROM
            (SELECT unnest(incoming.pomodoro_session_ids) EXCEPT SELECT unnest(existing.pomodoro_session_ids)) fresh)),
          pomodoro_session_ids=ARRAY(SELECT DISTINCT unnest(existing.pomodoro_session_ids || incoming.pomodoro_session_ids)),
          order_index=incoming.order_index,
          completed_at=incoming.completed_at, updated_at=now() WHERE id=incoming.id;
      ELSE
        INSERT INTO public.tasks (id,user_id,group_id,title,description,completed,status,priority,category,
          due_date,due_time,pinned,pomodoros,pomodoro_session_ids,order_index,created_by_name,created_at,completed_at,updated_at)
        VALUES (incoming.id,auth.uid(),p_group_id,incoming.title,incoming.description,incoming.completed,
          incoming.status,incoming.priority,incoming.category,incoming.due_date,incoming.due_time,
          incoming.pinned,incoming.pomodoros,incoming.pomodoro_session_ids,incoming.order_index,incoming.created_by_name,
          coalesce(incoming.created_at,now()),incoming.completed_at,now());
      END IF;
      DELETE FROM public.subtasks WHERE task_id = incoming.id;
      FOR sub IN SELECT value FROM jsonb_array_elements(coalesce(change->'subtasks','[]'::jsonb)) LOOP
        IF sub->>'task_id' IS DISTINCT FROM incoming.id::text THEN RAISE EXCEPTION 'Subtarefa inválida.'; END IF;
        INSERT INTO public.subtasks (id,task_id,title,completed)
          SELECT r.id,r.task_id,r.title,r.completed FROM jsonb_populate_record(NULL::public.subtasks,sub) r;
      END LOOP;
    ELSE RAISE EXCEPTION 'Operação desconhecida.';
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.apply_task_changes(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_task_changes(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.join_group_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_group_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_group_ids() TO authenticated;

-- Return only public profile fields to fellow members, never their email.
CREATE OR REPLACE FUNCTION public.list_group_members(p_group_id uuid)
RETURNS TABLE(id uuid,group_id uuid,user_id uuid,role text,joined_at timestamptz,display_name text,avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id,m.group_id,m.user_id,m.role,m.joined_at,p.display_name,p.avatar_url
  FROM public.group_members m LEFT JOIN public.profiles p ON p.id=m.user_id
  WHERE m.group_id=p_group_id AND p_group_id IN (SELECT public.get_my_group_ids());
$$;
REVOKE ALL ON FUNCTION public.list_group_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_group_members(uuid) TO authenticated;
-- Repair owners created before the membership trigger existed.
INSERT INTO public.group_members(group_id,user_id,role)
  SELECT id,created_by,'owner' FROM public.groups
  ON CONFLICT(group_id,user_id) DO UPDATE SET role='owner';

-- Derive profile counters from committed task changes, not racing client requests.
CREATE OR REPLACE FUNCTION public.update_task_profile_counters() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE account uuid; completed_delta integer; focus_delta integer;
BEGIN
  IF TG_OP='DELETE' THEN
    account:=OLD.user_id; completed_delta:= -(OLD.completed::int); focus_delta:= -(OLD.pomodoros * 25);
  ELSIF TG_OP='INSERT' THEN
    account:=NEW.user_id; completed_delta:= NEW.completed::int; focus_delta:= NEW.pomodoros * 25;
  ELSE
    account:=NEW.user_id; completed_delta:= NEW.completed::int - OLD.completed::int;
    focus_delta:= (NEW.pomodoros - OLD.pomodoros) * 25;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=account) THEN RETURN NULL; END IF;
  INSERT INTO public.profiles(id,completed_tasks_count,focus_minutes)
    VALUES(account,greatest(0,completed_delta),greatest(0,focus_delta))
    ON CONFLICT(id) DO UPDATE SET
      completed_tasks_count=greatest(0,profiles.completed_tasks_count+completed_delta),
      focus_minutes=greatest(0,profiles.focus_minutes+focus_delta),updated_at=now();
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS update_task_profile_counters ON public.tasks;
CREATE TRIGGER update_task_profile_counters AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_task_profile_counters();
UPDATE public.profiles p SET
  completed_tasks_count=(SELECT count(*) FROM public.tasks t WHERE t.user_id=p.id AND t.completed),
  focus_minutes=(SELECT coalesce(sum(t.pomodoros),0)*25 FROM public.tasks t WHERE t.user_id=p.id);
COMMIT;
