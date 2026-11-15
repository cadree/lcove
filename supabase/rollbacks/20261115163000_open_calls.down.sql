-- Undo 20261115163000_open_calls.sql. Revert the app commit first.
-- Roles created through an open call stay on their projects, and applications
-- made through a call stay as normal role applications.
DROP FUNCTION IF EXISTS public.open_calls_near(text);
DROP FUNCTION IF EXISTS public.close_open_call(uuid);
DROP FUNCTION IF EXISTS public.post_open_call(uuid, uuid, text, date, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.open_call_live(uuid);
DROP TABLE IF EXISTS public.project_open_calls;
