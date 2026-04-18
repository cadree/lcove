-- 1. Add new columns to exclusive_tracks
ALTER TABLE public.exclusive_tracks
  ADD COLUMN IF NOT EXISTS allow_downloads boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_on_profile boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preview_start_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preview_duration_seconds integer NOT NULL DEFAULT 15;

-- 2. Ensure published exclusive tracks are publicly viewable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exclusive_tracks'
      AND policyname = 'Published exclusive tracks are viewable by everyone'
  ) THEN
    CREATE POLICY "Published exclusive tracks are viewable by everyone"
      ON public.exclusive_tracks
      FOR SELECT
      USING (is_published = true AND visible_on_profile = true);
  END IF;
END $$;

-- 3. Create music_saves table
CREATE TABLE IF NOT EXISTS public.music_saves (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  track_id uuid NOT NULL REFERENCES public.exclusive_tracks(id) ON DELETE CASCADE,
  added_to_profile boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_music_saves_user ON public.music_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_music_saves_track ON public.music_saves(track_id);
CREATE INDEX IF NOT EXISTS idx_music_saves_profile ON public.music_saves(user_id) WHERE added_to_profile = true;

ALTER TABLE public.music_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own saves"
  ON public.music_saves FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view profile-displayed saves"
  ON public.music_saves FOR SELECT
  USING (added_to_profile = true);

CREATE POLICY "Users insert own saves"
  ON public.music_saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own saves"
  ON public.music_saves FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own saves"
  ON public.music_saves FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_music_saves_updated_at
  BEFORE UPDATE ON public.music_saves
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();