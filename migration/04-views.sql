-- ============================================
-- ETHER Migration: Views
-- Target: waafzlorvnozeujjhvxu
-- Generated: 2026-01-26
-- ============================================

-- Public profiles view (excludes sensitive data)
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  user_id,
  display_name,
  username,
  bio,
  avatar_url,
  cover_url,
  location,
  website,
  city,
  is_featured,
  featured_media_url,
  featured_media_type,
  show_in_directory,
  is_private,
  instagram_url,
  twitter_url,
  linkedin_url,
  tiktok_url,
  youtube_url,
  spotify_url,
  soundcloud_url,
  created_at
FROM public.profiles
WHERE show_in_directory = true 
  AND is_private = false
  AND access_status = 'active';

-- Live streams public view (hides stream keys)
CREATE OR REPLACE VIEW public.live_streams_public AS
SELECT 
  id,
  user_id,
  title,
  description,
  thumbnail_url,
  -- Only show stream_key to the owner
  CASE 
    WHEN user_id = auth.uid() THEN stream_key 
    ELSE NULL 
  END as stream_key,
  -- Only show rtmp_url to the owner
  CASE 
    WHEN user_id = auth.uid() THEN rtmp_url 
    ELSE NULL 
  END as rtmp_url,
  playback_url,
  mux_playback_id,
  status,
  viewer_count,
  started_at,
  ended_at,
  scheduled_for,
  category,
  is_private,
  replay_url,
  replay_available,
  tips_enabled,
  total_tips,
  created_at,
  updated_at
FROM public.live_streams;
