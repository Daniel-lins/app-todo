-- Trigger functions execute through their triggers, not as public API endpoints.
REVOKE EXECUTE ON FUNCTION public.handle_new_group() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_task_profile_counters() FROM PUBLIC, anon, authenticated;
