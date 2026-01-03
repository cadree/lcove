-- Add thumbnail focal point column to store the focus position for cover art
ALTER TABLE public.live_streams ADD COLUMN IF NOT EXISTS thumbnail_focal_point jsonb DEFAULT '{"x": 50, "y": 50}'::jsonb;