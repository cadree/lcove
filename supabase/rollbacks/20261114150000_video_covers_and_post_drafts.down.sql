-- Rollback for 20261114150000_video_covers_and_post_drafts.sql.
-- Drops every saved draft. Export public.post_drafts first if any should be kept.
DROP TRIGGER IF EXISTS touch_post_draft ON public.post_drafts;
DROP FUNCTION IF EXISTS public.touch_post_draft();
DROP TABLE IF EXISTS public.post_drafts;
ALTER TABLE public.posts DROP COLUMN IF EXISTS thumbnail_url;
DELETE FROM public.ether_schema_migrations WHERE version = '20261114150000_video_covers_and_post_drafts.sql';
