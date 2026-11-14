-- Prove the stale-live migration with real writes as the authenticated role.
-- The transaction rolls back. This file builds a scratch database; it does
-- not connect to ether-prod.
--
--   createdb ether_stale_live_check
--   psql ether_stale_live_check -v ON_ERROR_STOP=1 -f scripts/stale-live-local-check.sql

\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA auth, public TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.live_streams (
  id uuid PRIMARY KEY,
  host_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  stream_type text NOT NULL,
  is_live boolean DEFAULT false,
  started_at timestamptz,
  ended_at timestamptz,
  viewer_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stream_viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE (stream_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);

\ir ../supabase/migrations/20261024180000_stale_lives_and_story_views.sql

BEGIN;

INSERT INTO public.live_streams (id, host_id, title, stream_type, is_live, started_at, created_at)
VALUES
  ('01999999-0000-4000-8000-0000000000a1', '11111111-1111-4111-8111-111111111111', 'stale', 'webrtc', true, now() - interval '20 minutes', now() - interval '20 minutes'),
  ('01999999-0000-4000-8000-0000000000a2', '11111111-1111-4111-8111-111111111111', 'fresh', 'webrtc', true, now(), now());

INSERT INTO public.stream_viewers (stream_id, viewer_id, last_seen)
VALUES ('01999999-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222222', now());

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SET LOCAL ROLE authenticated;
SELECT public.touch_host_presence('01999999-0000-4000-8000-0000000000a2'::uuid);
RESET ROLE;

DO $beat$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.live_streams
    WHERE id = '01999999-0000-4000-8000-0000000000a2'
      AND host_seen_at IS NOT NULL
      AND is_live IS TRUE
  ) THEN
    RAISE EXCEPTION 'authenticated heartbeat did not write host_seen_at';
  END IF;
END
$beat$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SET LOCAL ROLE authenticated;
DO $other$
BEGIN
  PERFORM public.touch_host_presence('01999999-0000-4000-8000-0000000000a2'::uuid);
  RAISE EXCEPTION 'a viewer was allowed to write the host heartbeat';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%not host%' THEN
      RAISE;
    END IF;
END
$other$;
RESET ROLE;

DO $denied$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM public.close_stale_live_streams();
  RAISE EXCEPTION 'authenticated was allowed to close streams';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END
$denied$;
RESET ROLE;

SELECT public.close_stale_live_streams();

DO $closed$
DECLARE
  stale_live boolean;
  fresh_live boolean;
  viewer_left timestamptz;
BEGIN
  SELECT is_live INTO stale_live
  FROM public.live_streams
  WHERE id = '01999999-0000-4000-8000-0000000000a1';
  SELECT is_live INTO fresh_live
  FROM public.live_streams
  WHERE id = '01999999-0000-4000-8000-0000000000a2';
  SELECT left_at INTO viewer_left
  FROM public.stream_viewers
  WHERE stream_id = '01999999-0000-4000-8000-0000000000a1';

  IF stale_live IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'stale live was not closed';
  END IF;
  IF fresh_live IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'fresh live was closed';
  END IF;
  IF viewer_left IS NULL THEN
    RAISE EXCEPTION 'stale viewers were not marked left';
  END IF;
END
$closed$;

ROLLBACK;
