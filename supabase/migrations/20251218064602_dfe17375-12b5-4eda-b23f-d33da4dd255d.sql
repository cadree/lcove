-- Add profile music volume field for controlling default playback volume
ALTER TABLE public.profile_customizations 
ADD COLUMN IF NOT EXISTS profile_music_volume numeric DEFAULT 0.5;