-- A crashed host never reaches the unmount update that clears is_live.
-- The host writes host_seen_at while the room is up. A minute job closes
-- rows whose heartbeat is older than three minutes, including rows that
-- went live before this column existed.
--
-- story_views(viewer_id, story_id) serves the feed's single "have I seen
-- these" lookup. The unique (story_id, viewer_id) index leads with story_id.

ALTER TABLE public.live_streams
  ADD COLUMN IF NOT EXISTS host_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_live_streams_stale_host
  ON public.live_streams (host_seen_at)
  WHERE is_live IS TRUE;

CREATE INDEX IF NOT EXISTS idx_story_views_viewer
  ON public.story_views (viewer_id, story_id);

CREATE OR REPLACE FUNCTION public.touch_host_presence(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.live_streams
  SET host_seen_at = now()
  WHERE id = p_stream_id
    AND host_id = auth.uid()
    AND is_live IS TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not host';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_host_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_host_presence(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_stale_live_streams()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH closed AS (
    UPDATE public.live_streams
    SET is_live = false,
        ended_at = COALESCE(ended_at, now()),
        viewer_count = 0
    WHERE is_live IS TRUE
      AND COALESCE(host_seen_at, started_at, created_at) < now() - interval '3 minutes'
    RETURNING id
  ), marked AS (
    UPDATE public.stream_viewers AS viewers
    SET left_at = now()
    FROM closed
    WHERE viewers.stream_id = closed.id
      AND viewers.left_at IS NULL
    RETURNING viewers.stream_id
  )
  SELECT count(*)::integer INTO v_count FROM closed;

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.close_stale_live_streams() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_stale_live_streams() TO service_role;

-- No secrets in the command. Dashboard cron jobs stay as they are.
DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close-stale-live-streams') THEN
    PERFORM cron.unschedule('close-stale-live-streams');
  END IF;
  PERFORM cron.schedule(
    'close-stale-live-streams',
    '* * * * *',
    $job$SELECT public.close_stale_live_streams()$job$
  );
EXCEPTION
  WHEN undefined_table OR undefined_object OR undefined_function OR invalid_schema_name OR insufficient_privilege THEN
    RAISE NOTICE 'close-stale-live-streams was not scheduled: %', SQLERRM;
END
$cron$;
