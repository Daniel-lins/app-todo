BEGIN;
ALTER TABLE public.tasks ADD COLUMN planning jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(planning)='object');
ALTER TABLE public.subtasks ADD COLUMN notes text CHECK (length(notes)<=5000), ADD COLUMN due_date date,
  ADD COLUMN position integer NOT NULL DEFAULT 0 CHECK (position>=0),
  ADD COLUMN completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, ADD COLUMN completed_at timestamptz;
CREATE OR REPLACE FUNCTION public.apply_task_changes(p_group_id uuid, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE change jsonb; incoming public.tasks%ROWTYPE; existing public.tasks%ROWTYPE; sub jsonb; old_steps jsonb;
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
      incoming.kind := coalesce(incoming.kind, 'task');
      IF incoming.kind NOT IN ('task','mission') THEN RAISE EXCEPTION 'Tipo de tarefa inválido.'; END IF;
      IF incoming.kind='mission' THEN
        IF jsonb_typeof(change->'subtasks') IS DISTINCT FROM 'array' OR jsonb_array_length(change->'subtasks')=0
          THEN RAISE EXCEPTION 'Adicione pelo menos uma etapa à missão grande.'; END IF;
        IF incoming.completed AND EXISTS (SELECT 1 FROM jsonb_array_elements(change->'subtasks') s WHERE coalesce((s->>'completed')::boolean,false)=false)
          THEN RAISE EXCEPTION 'Conclua todas as etapas da missão.'; END IF;
      END IF;
      incoming.planning := coalesce(incoming.planning, '{}'::jsonb);
      IF incoming.planning->>'recurrence' IS NOT NULL AND (incoming.kind='mission' OR incoming.planning->>'recurrence' NOT IN ('daily','weekly','monthly')) THEN RAISE EXCEPTION 'Repetição inválida.'; END IF;
      IF incoming.planning->>'assigned_to' IS NOT NULL AND NOT (
        (p_group_id IS NULL AND incoming.planning->>'assigned_to'=auth.uid()::text) OR
        (p_group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id=p_group_id AND m.user_id::text=incoming.planning->>'assigned_to'))
      ) THEN RAISE EXCEPTION 'O responsável precisa pertencer ao espaço.'; END IF;
      SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO old_steps FROM public.subtasks s WHERE task_id=incoming.id;
      SELECT * INTO existing FROM public.tasks WHERE id = incoming.id;
      IF FOUND THEN
        IF incoming.id LIKE 'repeat:%' AND existing.updated_at > incoming.updated_at THEN CONTINUE; END IF;
        IF existing.group_id IS DISTINCT FROM p_group_id THEN RAISE EXCEPTION 'A tarefa pertence a outro espaço.'; END IF;
        UPDATE public.tasks SET planning=incoming.planning, kind=incoming.kind, title=incoming.title, description=incoming.description,
          completed=incoming.completed, status=incoming.status, priority=incoming.priority,
          category=incoming.category, due_date=incoming.due_date, due_time=incoming.due_time,
          pinned=incoming.pinned,
          pomodoros=greatest(incoming.pomodoros, existing.pomodoros + (SELECT count(*) FROM
            (SELECT unnest(incoming.pomodoro_session_ids) EXCEPT SELECT unnest(existing.pomodoro_session_ids)) fresh)),
          pomodoro_session_ids=ARRAY(SELECT DISTINCT unnest(existing.pomodoro_session_ids || incoming.pomodoro_session_ids)),
          order_index=incoming.order_index,
          completed_at=incoming.completed_at, updated_at=now() WHERE id=incoming.id;
      ELSE
        INSERT INTO public.tasks (id,user_id,group_id,title,description,completed,status,priority,category,kind,planning,
          due_date,due_time,pinned,pomodoros,pomodoro_session_ids,order_index,created_by_name,created_at,completed_at,updated_at)
        VALUES (incoming.id,auth.uid(),p_group_id,incoming.title,incoming.description,incoming.completed,
          incoming.status,incoming.priority,incoming.category,incoming.kind,incoming.planning,incoming.due_date,incoming.due_time,
          incoming.pinned,incoming.pomodoros,incoming.pomodoro_session_ids,incoming.order_index,incoming.created_by_name,
          coalesce(incoming.created_at,now()),incoming.completed_at,now());
      END IF;
      DELETE FROM public.subtasks WHERE task_id = incoming.id;
      FOR sub IN SELECT value FROM jsonb_array_elements(coalesce(change->'subtasks','[]'::jsonb)) LOOP
        IF sub->>'task_id' IS DISTINCT FROM incoming.id::text THEN RAISE EXCEPTION 'Subtarefa inválida.'; END IF;
        INSERT INTO public.subtasks (id,task_id,title,completed,notes,due_date,position,completed_by,completed_at)
          SELECT r.id,r.task_id,r.title,r.completed,r.notes,r.due_date,coalesce(r.position,0),
            CASE WHEN r.completed THEN coalesce((SELECT (s->>'completed_by')::uuid FROM jsonb_array_elements(old_steps) s WHERE s->>'id'=r.id AND (s->>'completed')::boolean), auth.uid()) END,
            CASE WHEN r.completed THEN coalesce((SELECT (s->>'completed_at')::timestamptz FROM jsonb_array_elements(old_steps) s WHERE s->>'id'=r.id AND (s->>'completed')::boolean), now()) END
          FROM jsonb_populate_record(NULL::public.subtasks,sub) r;
      END LOOP;
    ELSE RAISE EXCEPTION 'Operação desconhecida.';
    END IF;
  END LOOP;
END $$;

CREATE TABLE public.task_comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_comments_task_created ON public.task_comments(task_id,created_at);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_comments FROM anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.task_comments TO authenticated;
CREATE POLICY comments_read ON public.task_comments FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND t.group_id IN (SELECT public.get_my_group_ids()))
);
CREATE POLICY comments_insert ON public.task_comments FOR INSERT TO authenticated WITH CHECK (
 author_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND t.group_id IN (SELECT public.get_my_group_ids()))
);
CREATE POLICY comments_delete ON public.task_comments FOR DELETE TO authenticated USING (
 author_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND t.group_id IN (SELECT public.get_my_group_ids()))
);
COMMIT;
