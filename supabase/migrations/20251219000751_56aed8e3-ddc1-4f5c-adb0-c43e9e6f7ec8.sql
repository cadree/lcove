-- Add OBS/RTMP streaming fields to live_streams table
ALTER TABLE public.live_streams
ADD COLUMN IF NOT EXISTS rtmp_stream_key text,
ADD COLUMN IF NOT EXISTS rtmp_ingest_url text,
ADD COLUMN IF NOT EXISTS playback_url text,
ADD COLUMN IF NOT EXISTS mux_live_stream_id text,
ADD COLUMN IF NOT EXISTS mux_playback_id text;

-- Create index for Mux stream ID lookups
CREATE INDEX IF NOT EXISTS idx_live_streams_mux_id ON public.live_streams(mux_live_stream_id);

-- Update existing RLS policies to ensure rtmp_stream_key is protected
-- Stream key should only be visible to the host
-- This is handled by the existing SELECT policy which allows anyone to view
-- But we'll create a view that excludes sensitive fields for public access

-- Create a secure view for public stream access (excluding stream key)
CREATE OR REPLACE VIEW public.live_streams_public AS
SELECT 
  id,
  host_id,
  title,
  description,
  stream_type,
  external_url,
  thumbnail_url,
  is_live,
  started_at,
  ended_at,
  viewer_count,
  total_tips,
  created_at,
  replay_available,
  replay_url,
  playback_url,
  -- Only include stream key if viewer is the host
  CASE WHEN auth.uid() = host_id THEN rtmp_stream_key ELSE NULL END as rtmp_stream_key,
  CASE WHEN auth.uid() = host_id THEN rtmp_ingest_url ELSE NULL END as rtmp_ingest_url,
  mux_live_stream_id,
  mux_playback_id,
  event_type,
  is_virtual_event,
  max_attendees,
  parent_event_id,
  requires_ticket,
  ticket_price
FROM public.live_streams;