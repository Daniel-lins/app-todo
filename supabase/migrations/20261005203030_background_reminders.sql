BEGIN;
CREATE TABLE public.push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE CHECK (endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' AND length(endpoint)<4096),
 p256dh text NOT NULL CHECK (length(p256dh) BETWEEN 80 AND 100), auth text NOT NULL CHECK (length(auth) BETWEEN 20 AND 30),
 timezone text NOT NULL DEFAULT 'America/Sao_Paulo', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
CREATE POLICY push_select ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY push_insert ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY push_update ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY push_delete ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE FUNCTION private.validate_push_timezone() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Fuso horário inválido.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_push_timezone() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_push_timezone BEFORE INSERT OR UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION private.validate_push_timezone();

CREATE TABLE private.web_push_config (id boolean PRIMARY KEY DEFAULT true CHECK (id), public_key text NOT NULL, private_key text NOT NULL, cron_secret text NOT NULL);
ALTER TABLE private.web_push_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.web_push_config FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.get_push_public_key() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.'; END IF;
 RETURN (SELECT public_key FROM private.web_push_config WHERE id);
END $$;
REVOKE ALL ON FUNCTION public.get_push_public_key() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_push_public_key() TO authenticated;
CREATE FUNCTION public.get_push_config() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(c) FROM private.web_push_config c WHERE id
$$;
REVOKE ALL ON FUNCTION public.get_push_config() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_config() TO service_role;

CREATE TABLE public.push_deliveries (
 subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
 task_id text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE, deadline text NOT NULL,
 delivered boolean NOT NULL DEFAULT false, attempts integer NOT NULL DEFAULT 1, last_attempt timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (subscription_id, task_id, deadline)
);
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.push_deliveries TO service_role;
CREATE INDEX tasks_pending_due ON public.tasks(due_date) WHERE NOT completed;
CREATE FUNCTION public.claim_push_reminders() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 WITH candidates AS (
  SELECT s.id AS subscription_id,t.id AS task_id,t.due_date::text||'T'||coalesce(t.due_time::text,'09:00') AS deadline
  FROM public.push_subscriptions s JOIN public.tasks t ON (
    (t.group_id IS NULL AND t.user_id=s.user_id) OR
    (t.group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id=t.group_id AND m.user_id=s.user_id)
      AND (t.planning->>'assigned_to' IS NULL OR t.planning->>'assigned_to'=s.user_id::text))
  )
  WHERE NOT t.completed AND t.due_date::text=(now() AT TIME ZONE s.timezone)::date::text
    AND (now() AT TIME ZONE s.timezone) BETWEEN (CASE WHEN pg_input_is_valid(t.due_date::text,'date') THEN t.due_date::date END)+(CASE WHEN pg_input_is_valid(t.due_time::text,'time') THEN t.due_time::time ELSE '09:00'::time END)-interval '15 minutes' AND (CASE WHEN pg_input_is_valid(t.due_date::text,'date') THEN t.due_date::date END)+(CASE WHEN pg_input_is_valid(t.due_time::text,'time') THEN t.due_time::time ELSE '09:00'::time END)+interval '15 minutes'
    AND NOT EXISTS (SELECT 1 FROM public.push_deliveries d WHERE d.subscription_id=s.id AND d.task_id=t.id AND d.deadline=t.due_date::text||'T'||coalesce(t.due_time::text,'09:00') AND (d.delivered OR d.attempts>=3 OR d.last_attempt>now()-interval '2 minutes'))
  ORDER BY t.due_date,t.id LIMIT 100
 ), claimed AS (
  INSERT INTO public.push_deliveries(subscription_id,task_id,deadline) SELECT * FROM candidates
  ON CONFLICT(subscription_id,task_id,deadline) DO UPDATE SET attempts=public.push_deliveries.attempts+1,last_attempt=now()
  WHERE NOT public.push_deliveries.delivered AND public.push_deliveries.attempts<3 AND public.push_deliveries.last_attempt<now()-interval '2 minutes'
  RETURNING subscription_id,task_id,deadline
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('subscription_id',c.subscription_id,'task_id',c.task_id,'deadline',c.deadline,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth)), '[]'::jsonb)
 FROM claimed c JOIN public.push_subscriptions s ON s.id=c.subscription_id
$$;
REVOKE ALL ON FUNCTION public.claim_push_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_reminders() TO service_role;
COMMIT;
