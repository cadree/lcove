-- Rollback for 20261114220000_locked_music.sql.
-- Tracks uploaded after the migration keep their file in `music-private` and have
-- audio_file_url NULL; after this rollback the old app cannot play them in full
-- (it falls back to the preview clip). The bucket and its objects are left in place:
-- delete them from the Storage dashboard if they are no longer needed.

DROP TRIGGER IF EXISTS guard_exclusive_track_audio ON public.exclusive_tracks;
DROP FUNCTION IF EXISTS public.guard_exclusive_track_audio();

DROP POLICY IF EXISTS "Owners and buyers read private music" ON storage.objects;
DROP POLICY IF EXISTS "Artists delete own private music" ON storage.objects;
DROP POLICY IF EXISTS "Artists update own private music" ON storage.objects;
DROP POLICY IF EXISTS "Artists upload own private music" ON storage.objects;

DROP FUNCTION IF EXISTS public.can_read_private_music(text);

ALTER TABLE public.exclusive_tracks DROP COLUMN IF EXISTS audio_file_path;
