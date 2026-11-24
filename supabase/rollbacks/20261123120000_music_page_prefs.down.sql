-- Rollback for 20261123120000_music_page_prefs.sql. Drops only the look, featured
-- item, loose order and release cover overrides. Albums and tracks are untouched.
DROP TABLE IF EXISTS public.music_page_prefs;
