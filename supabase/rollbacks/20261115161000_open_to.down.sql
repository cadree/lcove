-- Undo 20261115161000_open_to.sql. Revert the app commit first.
-- Saved "open to" tags are dropped with the table.
DROP FUNCTION IF EXISTS public.set_open_to(text[], date);
DROP TABLE IF EXISTS public.profile_open_to;
DROP FUNCTION IF EXISTS public.open_to_last_day(date, timestamptz);
