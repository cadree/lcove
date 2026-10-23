-- stream_gift_notices was created while default privileges granted anon and
-- authenticated every table privilege. REVOKE FROM PUBLIC does not remove
-- those role grants, so INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, and
-- TRIGGER were still held. Leave SELECT only. Default privileges apply at
-- CREATE time, and CREATE OR REPLACE does not grant them again.
--
-- Hide a notice when the signed-in viewer and the sender have blocked each
-- other in either direction. auth.uid() is null for anon, and either_blocked
-- is false when either side is null, so a signed-out viewer still sees the
-- public line. security_invoker stays false so the sender-or-host policy on
-- stream_gifts does not hide the row. security_barrier stays on.

CREATE OR REPLACE VIEW public.stream_gift_notices
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  g.id,
  g.stream_id,
  g.gift,
  g.created_at,
  COALESCE(NULLIF(btrim(p.display_name), ''), 'Someone') AS sender_name
FROM public.stream_gifts g
LEFT JOIN public.profiles_public p ON p.user_id = g.sender_id
WHERE NOT public.either_blocked(auth.uid(), g.sender_id);

COMMENT ON VIEW public.stream_gift_notices IS
  'Gift activity other viewers can read. No amounts, fees, or payment ids. Hidden when the viewer and the sender are blocked either way. security_invoker is false because stream_gifts SELECT is sender-or-host only.';

REVOKE ALL ON TABLE public.stream_gift_notices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.stream_gift_notices TO anon, authenticated;

-- "Hosts can delete own streams" let a host DELETE a live row and skip
-- delete_own_live_stream. That function is SECURITY DEFINER, so it can still
-- delete an ended row the host owns. With this policy gone, the table has no
-- DELETE policy and the function is the only delete path for anon and
-- authenticated.

DROP POLICY IF EXISTS "Hosts can delete own streams" ON public.live_streams;
