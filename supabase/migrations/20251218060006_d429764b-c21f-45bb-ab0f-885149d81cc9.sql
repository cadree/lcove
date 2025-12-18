-- Add additional music metadata fields to profile_customizations
ALTER TABLE public.profile_customizations
ADD COLUMN IF NOT EXISTS profile_music_source text DEFAULT 'upload',
ADD COLUMN IF NOT EXISTS profile_music_album_art_url text,
ADD COLUMN IF NOT EXISTS profile_music_album_name text,
ADD COLUMN IF NOT EXISTS profile_music_preview_url text,
ADD COLUMN IF NOT EXISTS profile_music_external_id text;