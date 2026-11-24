-- "Open to" on profiles: a short preset list (shoots, features, paid gigs,
-- collabs, mentoring, studio sessions, events, travel work) and an optional
-- "until" date. Shown on the profile and on people cards, filterable in Explore.
--
-- Auto-expiry: tags stop showing the day after "until". Without a date they
-- stop showing 90 days after the last save, so stale availability never
-- lingers. Expired rows stay readable by their owner, so the editor can offer
-- to renew them.
-- Hidden from: blocked pairs (either way), banned, suspended or deleted accounts.
-- Writes go through set_open_to; the table has no client write grant.
-- Rollback: supabase/rollbacks/20261115161000_open_to.down.sql

CREATE TABLE IF NOT EXISTS public.profile_open_to (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tags text[] NOT NULL,
  until date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_open_to_tags CHECK (
    cardinality(tags) BETWEEN 1 AND 8
    AND tags <@ ARRAY['shoots', 'features', 'paid_gigs', 'collabs', 'mentoring', 'studio_sessions', 'events', 'travel_work']::text[]
  )
);

ALTER TABLE public.profile_open_to ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_open_to FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_open_to TO authenticated;
GRANT ALL ON public.profile_open_to TO service_role;

-- The last day the tags show (UTC dates, like the rest of discovery).
CREATE OR REPLACE FUNCTION public.open_to_last_day(p_until date, p_updated timestamptz)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $$
  SELECT coalesce(p_until, (p_updated AT TIME ZONE 'UTC')::date + 90);
$$;

DROP POLICY IF EXISTS "Open to: owner, and current tags for members" ON public.profile_open_to;
CREATE POLICY "Open to: owner, and current tags for members"
ON public.profile_open_to
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.open_to_last_day(until, updated_at) >= (now() AT TIME ZONE 'UTC')::date
    AND NOT public.either_blocked(auth.uid(), user_id)
    AND public.creative_account_ok(user_id)
  )
);

-- Save what I'm open to. An empty list clears it.
CREATE OR REPLACE FUNCTION public.set_open_to(p_tags text[], p_until date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  me uuid := auth.uid();
  today date := (now() AT TIME ZONE 'UTC')::date;
  clean text[];
  saved public.profile_open_to%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF NOT public.creative_account_ok(me) THEN
    RAISE EXCEPTION 'This account is not allowed to do that' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(array_agg(DISTINCT t ORDER BY t), '{}') INTO clean
  FROM unnest(coalesce(p_tags, '{}')) AS t WHERE t IS NOT NULL AND btrim(t) <> '';
  IF cardinality(clean) = 0 THEN
    DELETE FROM public.profile_open_to WHERE user_id = me;
    RETURN jsonb_build_object('tags', '[]'::jsonb, 'until', NULL, 'last_day', NULL);
  END IF;
  IF NOT clean <@ ARRAY['shoots', 'features', 'paid_gigs', 'collabs', 'mentoring', 'studio_sessions', 'events', 'travel_work']::text[] THEN
    RAISE EXCEPTION 'Pick from the list';
  END IF;
  IF p_until IS NOT NULL AND (p_until < today OR p_until > today + 180) THEN
    RAISE EXCEPTION 'Pick an end date in the next 6 months';
  END IF;
  INSERT INTO public.profile_open_to (user_id, tags, until, updated_at)
  VALUES (me, clean, p_until, now())
  ON CONFLICT (user_id) DO UPDATE SET tags = excluded.tags, until = excluded.until, updated_at = excluded.updated_at
  RETURNING * INTO saved;
  RETURN jsonb_build_object('tags', to_jsonb(saved.tags), 'until', saved.until,
    'last_day', public.open_to_last_day(saved.until, saved.updated_at));
END;
$$;

REVOKE ALL ON FUNCTION public.open_to_last_day(date, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_open_to(text[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_to_last_day(date, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_open_to(text[], date) TO authenticated;
