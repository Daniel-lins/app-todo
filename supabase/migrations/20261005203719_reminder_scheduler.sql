BEGIN;
ALTER TABLE private.web_push_config ADD COLUMN function_url text;
-- Hosted projects support these extensions. Local test engines can omit them.
DO $setup$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') AND EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_net') THEN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  EXECUTE $schedule$ SELECT cron.schedule('apptodo-deadline-reminders','* * * * *', $job$
    DELETE FROM public.push_deliveries WHERE last_attempt < now()-interval '30 days';
    SELECT net.http_post(url:=function_url,headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',cron_secret),body:='{}'::jsonb,timeout_milliseconds:=60000)
    FROM private.web_push_config WHERE id AND function_url IS NOT NULL;
  $job$) $schedule$;
 END IF;
END $setup$;
COMMIT;
