-- Undo 20261115190000_access_status_self_approve_guard.sql.
DROP TRIGGER IF EXISTS ether_access_self_approve_guard ON public.profiles;
DROP FUNCTION IF EXISTS public.ether_access_self_approve_guard();
