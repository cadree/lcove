-- Locked (paid) music: the full audio file lives in a private bucket and only the
-- artist, a buyer with a paid purchase, or an active subscriber can read it.
--
-- Before this, uploads went to the public `media` bucket and exclusive_tracks
-- stored the public URL, which every visitor could read from the table and play
-- or download without paying.
--
-- Apply by hand (migrations are not deployed by CI). Rollback:
-- supabase/rollbacks/20261114220000_locked_music.down.sql

-- 1. Path of the full file inside the private bucket: "<artist user id>/<file>".
ALTER TABLE public.exclusive_tracks ADD COLUMN IF NOT EXISTS audio_file_path text;

-- 2. Private bucket. 50 MB matches the project's global upload limit.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('music-private', 'music-private', false, 52428800, ARRAY['audio/*'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Who may read one private object. SECURITY DEFINER so the storage policy can
-- look at purchases and subscriptions without exposing those tables.
CREATE OR REPLACE FUNCTION public.can_read_private_music(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    split_part(p_object_name, '/', 1) = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.exclusive_tracks t
      WHERE t.audio_file_path = p_object_name
        AND (
          EXISTS (
            SELECT 1 FROM public.exclusive_track_purchases p
            WHERE p.track_id = t.id
              AND p.buyer_user_id = auth.uid()
              AND p.payment_status = 'paid'
          )
          OR EXISTS (
            SELECT 1 FROM public.artist_subscriptions s
            WHERE s.artist_user_id = t.artist_user_id
              AND s.subscriber_user_id = auth.uid()
              AND s.status = 'active'
              AND (s.current_period_end IS NULL OR s.current_period_end > now())
          )
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_private_music(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_private_music(text) TO anon, authenticated, service_role;

-- 4. Storage policies for the private bucket. Artists write only in their own
-- folder; reads go through can_read_private_music (signed URLs are minted by the
-- storage API only when this SELECT policy passes for the caller).
DROP POLICY IF EXISTS "Artists upload own private music" ON storage.objects;
CREATE POLICY "Artists upload own private music" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'music-private' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Artists update own private music" ON storage.objects;
CREATE POLICY "Artists update own private music" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'music-private' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'music-private' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Artists delete own private music" ON storage.objects;
CREATE POLICY "Artists delete own private music" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'music-private' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners and buyers read private music" ON storage.objects;
CREATE POLICY "Owners and buyers read private music" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'music-private' AND public.can_read_private_music(name));

-- 5. Guard: no new public full-length URLs, and a track can only point at a file
-- in its own artist's folder (otherwise buying a cheap track could unlock another
-- artist's file). Clearing audio_file_url is always allowed.
CREATE OR REPLACE FUNCTION public.guard_exclusive_track_audio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.audio_file_url IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.audio_file_url IS DISTINCT FROM OLD.audio_file_url) THEN
    RAISE EXCEPTION 'Exclusive tracks are stored privately now. Update Ether and upload the track again.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.audio_file_path IS NOT NULL
     AND split_part(NEW.audio_file_path, '/', 1) <> NEW.artist_user_id::text THEN
    RAISE EXCEPTION 'audio_file_path must be in the artist''s own folder'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_exclusive_track_audio ON public.exclusive_tracks;
CREATE TRIGGER guard_exclusive_track_audio
  BEFORE INSERT OR UPDATE OF audio_file_url, audio_file_path, artist_user_id ON public.exclusive_tracks
  FOR EACH ROW EXECUTE FUNCTION public.guard_exclusive_track_audio();
