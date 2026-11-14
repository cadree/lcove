-- Video covers and private post drafts.
--
-- 1. posts.thumbnail_url: the cover image for a video post (picked frame,
--    uploaded image, or a frame captured at about 1s). Nullable, so existing
--    rows and older app builds keep working; the app falls back to a frame.
-- 2. post_drafts: drafts live in their own owner-only table instead of a flag
--    on posts. Feeds, explore, reels, profile grids, search functions and the
--    XP/moderation triggers on posts never see them, by construction.
--    Publishing inserts a normal posts row and deletes the draft.
-- Rollback: supabase/rollbacks/20261114150000_video_covers_and_post_drafts.down.sql

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS thumbnail_url text;

COMMENT ON COLUMN public.posts.thumbnail_url IS 'Cover image for a video post. Null for photos, text, and videos posted before covers existed.';

CREATE TABLE IF NOT EXISTS public.post_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text CHECK (content IS NULL OR char_length(content) <= 2200),
  media_url text,
  media_type text NOT NULL DEFAULT 'text' CHECK (media_type IN ('photo', 'video', 'text')),
  thumbnail_url text,
  post_type text NOT NULL DEFAULT 'regular',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_drafts_user_updated_idx ON public.post_drafts (user_id, updated_at DESC);

ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_drafts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their drafts" ON public.post_drafts;
CREATE POLICY "Owners read their drafts" ON public.post_drafts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners write their drafts" ON public.post_drafts;
CREATE POLICY "Owners write their drafts" ON public.post_drafts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners edit their drafts" ON public.post_drafts;
CREATE POLICY "Owners edit their drafts" ON public.post_drafts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners delete their drafts" ON public.post_drafts;
CREATE POLICY "Owners delete their drafts" ON public.post_drafts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.post_drafts FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.post_drafts TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_post_draft()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_post_draft ON public.post_drafts;
CREATE TRIGGER touch_post_draft
  BEFORE UPDATE ON public.post_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_post_draft();
