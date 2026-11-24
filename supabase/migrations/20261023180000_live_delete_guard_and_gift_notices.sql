-- delete_own_live_stream already ran from 20261023160000. A stream that is
-- still live must be ended first, so the replay file is not removed out
-- from under the room. CREATE OR REPLACE keeps SECURITY DEFINER and the
-- search_path from that earlier function.

CREATE OR REPLACE FUNCTION public.delete_own_live_stream(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_streams
    WHERE id = p_stream_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only delete your own streams'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.live_streams
    WHERE id = p_stream_id AND host_id = auth.uid() AND is_live IS TRUE
  ) THEN
    RAISE EXCEPTION 'End the live stream before deleting it'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_streams
  SET parent_event_id = NULL
  WHERE parent_event_id = p_stream_id;

  DELETE FROM public.live_streams
  WHERE id = p_stream_id AND host_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_live_stream(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_live_stream(uuid) TO authenticated;

-- stream_gifts is readable only by the sender and the host, so other viewers
-- never see a gift and realtime hides the row from them too. This view is the
-- public line: who sent which gift. Amounts, fees, and payment ids are not
-- selected. security_invoker stays off because the base policy would hide
-- every row from the other viewers. security_barrier is on.

CREATE OR REPLACE VIEW public.stream_gift_notices
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  g.id,
  g.stream_id,
  g.gift,
  g.created_at,
  COALESCE(NULLIF(btrim(p.display_name), ''), 'Someone') AS sender_name
FROM public.stream_gifts g
LEFT JOIN public.profiles_public p ON p.user_id = g.sender_id;

COMMENT ON VIEW public.stream_gift_notices IS
  'Gift activity other viewers can read. No amounts, fees, or payment ids. security_invoker is false because stream_gifts SELECT is sender-or-host only.';

REVOKE ALL ON TABLE public.stream_gift_notices FROM PUBLIC;
GRANT SELECT ON TABLE public.stream_gift_notices TO anon, authenticated;
