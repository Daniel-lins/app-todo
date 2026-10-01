BEGIN;
CREATE TABLE public.rpg_task_history (
  scope_id text GENERATED ALWAYS AS (CASE WHEN group_id IS NULL THEN 'user:' || user_id::text ELSE 'group:' || group_id::text END) STORED,
  task_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  category text NOT NULL,
  priority text NOT NULL,
  completed boolean NOT NULL,
  completed_subtasks integer NOT NULL CHECK (completed_subtasks >= 0),
  pomodoros integer NOT NULL CHECK (pomodoros >= 0),
  deleted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (scope_id, task_id)
);
CREATE INDEX rpg_history_user_idx ON public.rpg_task_history(user_id) WHERE group_id IS NULL;
CREATE INDEX rpg_history_group_idx ON public.rpg_task_history(group_id) WHERE group_id IS NOT NULL;
ALTER TABLE public.rpg_task_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rpg_task_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rpg_task_history TO authenticated;
CREATE POLICY rpg_history_read ON public.rpg_task_history FOR SELECT TO authenticated
  USING ((group_id IS NULL AND user_id = (SELECT auth.uid())) OR group_id IN (SELECT public.get_my_group_ids()));

CREATE SCHEMA IF NOT EXISTS private;
-- Only triggers write the history. Clients cannot forge rewards or call this function.
CREATE FUNCTION private.capture_task_rpg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE task public.tasks%ROWTYPE; count_done integer; deleting boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'tasks' THEN
    IF TG_OP = 'DELETE' THEN task := OLD; deleting := true; ELSE task := NEW; END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      SELECT * INTO task FROM public.tasks WHERE id = OLD.task_id;
    ELSE
      SELECT * INTO task FROM public.tasks WHERE id = NEW.task_id;
    END IF;
    IF NOT FOUND THEN RETURN NULL; END IF;
    -- Cascading subtask removal must not erase the already preserved evidence.
    IF EXISTS (SELECT 1 FROM public.rpg_task_history h WHERE h.task_id=task.id::text
      AND h.scope_id=CASE WHEN task.group_id IS NULL THEN 'user:'||task.user_id::text ELSE 'group:'||task.group_id::text END
      AND h.deleted) THEN RETURN NULL; END IF;
  END IF;
  IF task.user_id IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=task.user_id) OR
    (task.group_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.groups WHERE id=task.group_id)) THEN
    IF deleting THEN RETURN OLD; END IF;
    RETURN NULL;
  END IF;
  SELECT count(*) INTO count_done FROM public.subtasks WHERE task_id=task.id AND completed;
  INSERT INTO public.rpg_task_history(task_id,user_id,group_id,category,priority,completed,completed_subtasks,pomodoros,deleted)
    VALUES(task.id::text,task.user_id,task.group_id,task.category,task.priority,task.completed,count_done,greatest(0,task.pomodoros),deleting)
    ON CONFLICT(scope_id,task_id) DO UPDATE SET category=excluded.category,priority=excluded.priority,
      completed=excluded.completed,completed_subtasks=excluded.completed_subtasks,pomodoros=excluded.pomodoros,deleted=excluded.deleted;
  IF TG_OP='DELETE' AND TG_TABLE_NAME='tasks' THEN RETURN OLD; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.capture_task_rpg() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_task_rpg AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION private.capture_task_rpg();
CREATE TRIGGER preserve_task_rpg BEFORE DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION private.capture_task_rpg();
CREATE TRIGGER capture_subtask_rpg AFTER INSERT OR UPDATE OR DELETE ON public.subtasks
  FOR EACH ROW EXECUTE FUNCTION private.capture_task_rpg();

INSERT INTO public.rpg_task_history(task_id,user_id,group_id,category,priority,completed,completed_subtasks,pomodoros)
  SELECT t.id::text,t.user_id,t.group_id,t.category,t.priority,t.completed,
    (SELECT count(*) FROM public.subtasks s WHERE s.task_id=t.id AND s.completed),greatest(0,t.pomodoros)
  FROM public.tasks t WHERE t.user_id IS NOT NULL;
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
      -- A task completed and removed offline may never have reached the server.
      -- Materialize its validated snapshot once so history survives queue compaction.
      IF jsonb_typeof(change->'task')='object'
        AND NOT EXISTS (SELECT 1 FROM public.tasks WHERE id::text=change->>'id')
        AND NOT EXISTS (SELECT 1 FROM public.rpg_task_history WHERE task_id=change->>'id'
          AND scope_id=CASE WHEN p_group_id IS NULL THEN 'user:'||auth.uid()::text ELSE 'group:'||p_group_id::text END) THEN
        PERFORM public.apply_task_changes(p_group_id, jsonb_build_array(change || jsonb_build_object('action','upsert')));
      END IF;
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
COMMIT;
