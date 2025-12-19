-- Fix security definer view issue by dropping and recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.live_streams_public;

CREATE VIEW public.live_streams_public 
WITH (security_invoker = true)
AS
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