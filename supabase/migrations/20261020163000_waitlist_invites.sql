-- Founder invites. Do not apply this file from the app. Cadre applies it.
-- An admin marks waitlist rows invited and receives a single-use token.
-- Claiming the token copies founding, src, and ref onto that person's profile
-- and marks the waitlist row converted. The onboarding quiz is unchanged.

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_invite_token_key
  ON public.waitlist (invite_token)
  WHERE invite_token IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signup_src text,
  ADD COLUMN IF NOT EXISTS signup_ref text;

COMMENT ON COLUMN public.profiles.founding IS
  'True when the account was created from a pre-launch waitlist invite. Clients cannot set this.';

-- Keep the public profile view's column order and add the badge flag at the end.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id,
  p.user_id,
  p.display_name,
  p.city,
  p.city_display,
  p.city_key,
  p.bio,
  p.avatar_url,
  p.passion_seriousness,
  p.access_level,
  p.onboarding_completed,
  p.created_at,
  p.updated_at,
  p.mindset_level,
  p.access_status,
  p.social_links,
  p.is_suspended,
  p.suspended_at,
  p.suspension_reason,
  p.onboarding_level,
  p.founding
FROM public.profiles p
WHERE
  p.user_id = auth.uid()
  OR COALESCE(p.show_only_to_passed_exam, false) = false
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1
    FROM public.profiles viewer
    WHERE viewer.user_id = auth.uid()
      AND viewer.passed_exam = true
  );

GRANT SELECT ON public.profiles_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_founding_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF coalesce(current_setting('ether.claim_waitlist', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.founding := OLD.founding;
  NEW.signup_src := OLD.signup_src;
  NEW.signup_ref := OLD.signup_ref;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS protect_founding_flag ON public.profiles;
CREATE TRIGGER protect_founding_flag
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_founding_flag();

REVOKE ALL ON FUNCTION public.protect_founding_flag() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_founding_flag() TO service_role;

CREATE OR REPLACE FUNCTION public.waitlist_admin_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(auth.role(), '') = 'service_role'
    OR coalesce(public.has_role(auth.uid(), 'admin'), false);
$fn$;

REVOKE ALL ON FUNCTION public.waitlist_admin_allowed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waitlist_admin_allowed() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_waitlist_admin(p_src text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  src text,
  ref_code text,
  referred_by text,
  invited_at timestamptz,
  invite_token text,
  converted_at timestamptz,
  founding boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_src text := lower(btrim(coalesce(p_src, '')));
BEGIN
  IF NOT public.waitlist_admin_allowed() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_src <> '' AND v_src NOT IN ('oct27', 'ig', 'dm', 'slack', 'familcy', 'sponsor', 'nuance', 'manifest', 'direct') THEN
    RAISE EXCEPTION 'invalid src';
  END IF;
  RETURN QUERY
  SELECT
    w.id, w.name, w.email, w.src, w.ref_code, w.referred_by,
    w.invited_at, w.invite_token, w.converted_at, w.founding, w.created_at
  FROM public.waitlist w
  WHERE v_src = '' OR w.src = v_src
  ORDER BY w.src, w.created_at;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_waitlist_admin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_waitlist_admin(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.invite_waitlist(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  email text,
  invite_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid;
  v_token text;
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  i integer;
  n integer;
  attempt integer;
BEGIN
  IF NOT public.waitlist_admin_allowed() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RAISE EXCEPTION 'select someone';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.waitlist w WHERE w.id = v_id AND w.converted_at IS NULL
    ) THEN
      CONTINUE;
    END IF;
    v_token := NULL;
    FOR attempt IN 1..8 LOOP
      v_token := '';
      FOR i IN 1..24 LOOP
        n := 1 + floor(random() * length(alphabet))::integer;
        v_token := v_token || substr(alphabet, n, 1);
      END LOOP;
      BEGIN
        UPDATE public.waitlist w
        SET invited_at = now(),
            invite_token = v_token
        WHERE w.id = v_id
          AND w.converted_at IS NULL;
        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          v_token := NULL;
      END;
    END LOOP;
    IF v_token IS NOT NULL THEN
      id := v_id;
      email := (SELECT w.email FROM public.waitlist w WHERE w.id = v_id);
      invite_token := v_token;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$fn$;

COMMENT ON FUNCTION public.invite_waitlist(uuid[]) IS
  'Admin or service_role. Marks unconverted rows invited and rotates a single-use token. Does not send email.';

REVOKE ALL ON FUNCTION public.invite_waitlist(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_waitlist(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.preview_waitlist_invite(p_token text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT w.email
  FROM public.waitlist w
  WHERE w.invite_token = btrim(coalesce(p_token, ''))
    AND w.converted_at IS NULL
    AND w.invited_at IS NOT NULL;
$fn$;

COMMENT ON FUNCTION public.preview_waitlist_invite(text) IS
  'Returns only the invited email for an unused token, or null.';

REVOKE ALL ON FUNCTION public.preview_waitlist_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_waitlist_invite(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_waitlist_invite(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.waitlist%ROWTYPE;
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_ref text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;

  SELECT * INTO v_row
  FROM public.waitlist w
  WHERE w.invite_token = btrim(coalesce(p_token, ''))
  FOR UPDATE;

  IF NOT FOUND OR v_row.converted_at IS NOT NULL OR v_row.invited_at IS NULL THEN
    RAISE EXCEPTION 'invite not active';
  END IF;
  IF v_email = '' OR v_email IS DISTINCT FROM lower(v_row.email) THEN
    RAISE EXCEPTION 'email mismatch';
  END IF;

  v_ref := coalesce(v_row.referred_by, v_row.ref_code);
  PERFORM set_config('ether.claim_waitlist', 'on', true);

  UPDATE public.profiles
  SET founding = true,
      signup_src = v_row.src,
      signup_ref = v_ref,
      signup_attribution = coalesce(signup_attribution, '{}'::jsonb) || jsonb_build_object(
        'src', v_row.src,
        'ref', v_ref,
        'waitlist_ref', v_row.ref_code,
        'founding', true
      )
  WHERE user_id = auth.uid();

  UPDATE public.waitlist
  SET converted_at = now(),
      converted_user_id = auth.uid()
  WHERE id = v_row.id;
END;
$fn$;

COMMENT ON FUNCTION public.claim_waitlist_invite(text) IS
  'Single-use. The signed-in email must match the waitlist row. Copies founding, src, and ref, then marks the row converted.';

REVOKE ALL ON FUNCTION public.claim_waitlist_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_waitlist_invite(text) TO authenticated, service_role;
