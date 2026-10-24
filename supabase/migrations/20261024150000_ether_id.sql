-- Ether ID: member card, signed verify token, and Apple Wallet pass updates.
--
-- Inventory this migration does not invent:
--   Peer reviews are public.user_reviews (rating 1-5, one row per reviewer).
--   reputation_scores.review_count is studio/store reviews, not peer reviews.
--   There is no endorsements table.
--   Projects completed are projects.status = 'completed' where the member is
--   the creator or an accepted applicant. Drafts and pending applications
--   are not counted.
--   Passion is the earliest user_passions row (custom_name, else passions.name).
--   Member since is profiles.created_at.
--   Active reuses the audience rule last_active_at >= now() - 30 days, plus
--   access_status = 'active' and onboarding_completed. Banned and suspended
--   win over that. birth_year stays an audience filter and is never shown.
--
-- Anon cannot read the card tables. The verify page calls
-- get_ether_id_by_token, which is SECURITY DEFINER and returns only the
-- public fields plus the live status.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS birthday_month smallint,
  ADD COLUMN IF NOT EXISTS birthday_day smallint,
  ADD COLUMN IF NOT EXISTS show_birthday boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.username IS
  'Public Ether ID handle. Lowercase, no @. Not a user id.';
COMMENT ON COLUMN public.profiles.birthday_month IS
  'Self-reported birthday month for Ether ID. Hidden unless show_birthday. Never an age check. birth_year is unrelated.';
COMMENT ON COLUMN public.profiles.birthday_day IS
  'Self-reported birthday day. No year is stored here.';
COMMENT ON COLUMN public.profiles.show_birthday IS
  'When false, Ether ID omits the birthday. Default false.';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Standing: a member cannot ban, unban, suspend, or unsuspend themselves.
-- Onboarding can still move a non-banned account to active.
-- This trigger is SECURITY INVOKER on purpose. SECURITY DEFINER would make
-- current_user the owner (postgres) and the platform bypass would always
-- fire. session_user stays postgres after SET ROLE, so it is not used.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ether_id_protect_standing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.access_status = 'banned' AND NEW.access_status IS DISTINCT FROM 'banned' THEN
    RAISE EXCEPTION 'only an admin can change a ban'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.access_status = 'banned' AND OLD.access_status IS DISTINCT FROM 'banned' THEN
    RAISE EXCEPTION 'only an admin can ban'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason THEN
    RAISE EXCEPTION 'only an admin can change a suspension'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ether_id_protect_standing ON public.profiles;
CREATE TRIGGER ether_id_protect_standing
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ether_id_protect_standing();

REVOKE ALL ON FUNCTION public.ether_id_protect_standing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_protect_standing() TO service_role;

-- ---------------------------------------------------------------------------
-- Username and birthday shape. Blank username clears. Feb 29 is allowed
-- because no year is stored (checked against leap year 2024).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ether_id_normalize_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(regexp_replace(btrim(NEW.username), '^@+', ''));
    IF NEW.username = '' THEN
      NEW.username := NULL;
    ELSIF NEW.username !~ '^[a-z0-9_]{3,20}$' THEN
      RAISE EXCEPTION 'username must be 3 to 20 letters, numbers, or underscores'
        USING ERRCODE = '23514';
    ELSIF public.objectionable_text(NEW.username) THEN
      RAISE EXCEPTION 'That username isn''t allowed.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.birthday_month IS NULL AND NEW.birthday_day IS NULL THEN
    NEW.show_birthday := false;
  ELSIF NEW.birthday_month IS NULL OR NEW.birthday_day IS NULL
        OR NEW.birthday_month < 1 OR NEW.birthday_month > 12
        OR NEW.birthday_day < 1 OR NEW.birthday_day > 31 THEN
    RAISE EXCEPTION 'birthday needs a real month and day'
      USING ERRCODE = '23514';
  ELSE
    BEGIN
      PERFORM make_date(2024, NEW.birthday_month::int, NEW.birthday_day::int);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'birthday is not a real month and day'
        USING ERRCODE = '23514';
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ether_id_normalize_profile ON public.profiles;
CREATE TRIGGER ether_id_normalize_profile
  BEFORE INSERT OR UPDATE OF username, birthday_month, birthday_day, show_birthday
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ether_id_normalize_profile();

REVOKE ALL ON FUNCTION public.ether_id_normalize_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_normalize_profile() TO service_role;

-- ---------------------------------------------------------------------------
-- Token, pass, and device tables. No policies: anon and authenticated
-- have no grant. Definer functions are the only read path.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ether_id_secret (
  id integer PRIMARY KEY CHECK (id = 1),
  secret text NOT NULL
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ether_id_secret WHERE id = 1) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'gen_random_bytes' AND n.nspname = 'extensions'
  ) THEN
    INSERT INTO public.ether_id_secret (id, secret)
    SELECT 1, encode(extensions.gen_random_bytes(32), 'hex');
  ELSE
    INSERT INTO public.ether_id_secret (id, secret)
    SELECT 1, encode(public.gen_random_bytes(32), 'hex');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ether_id_tokens (
  jti uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ether_id_tokens_one_live
  ON public.ether_id_tokens (user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.ether_id_passes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  serial_number text NOT NULL UNIQUE,
  auth_token text NOT NULL,
  pass_type_identifier text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_status text
);

CREATE TABLE IF NOT EXISTS public.ether_id_registrations (
  device_library_identifier text NOT NULL,
  pass_type_identifier text NOT NULL,
  serial_number text NOT NULL,
  push_token text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_library_identifier, pass_type_identifier, serial_number)
);

CREATE INDEX IF NOT EXISTS ether_id_registrations_serial
  ON public.ether_id_registrations (serial_number);

CREATE TABLE IF NOT EXISTS public.ether_id_push_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  serial_number text NOT NULL,
  next_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.ether_id_runtime (
  id integer PRIMARY KEY CHECK (id = 1),
  push_url text,
  push_secret text
);

INSERT INTO public.ether_id_runtime (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM public.ether_id_runtime WHERE id = 1);

ALTER TABLE public.ether_id_secret ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ether_id_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ether_id_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ether_id_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ether_id_push_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ether_id_runtime ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ether_id_secret FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ether_id_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ether_id_passes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ether_id_registrations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ether_id_push_queue FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ether_id_runtime FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Status and card
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ether_member_status(
  p_access_status text,
  p_is_suspended boolean,
  p_onboarding_completed boolean,
  p_last_active_at timestamptz
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_access_status = 'banned' THEN 'Banned'
    WHEN COALESCE(p_is_suspended, false) THEN 'Suspended'
    WHEN p_access_status = 'active'
      AND COALESCE(p_onboarding_completed, false)
      AND p_last_active_at >= now() - interval '30 days'
    THEN 'Active'
    ELSE 'Inactive'
  END;
$$;

REVOKE ALL ON FUNCTION public.ether_member_status(text, boolean, boolean, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_member_status(text, boolean, boolean, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_signature(p_body text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  -- extensions.hmac: pgcrypto lives in the extensions schema on hosted Supabase.
  SELECT translate(
    rtrim(encode(extensions.hmac(p_body, s.secret, 'sha256'), 'base64'), '='),
    '+/',
    '-_'
  )
  FROM public.ether_id_secret s
  WHERE s.id = 1;
$$;

REVOKE ALL ON FUNCTION public.ether_id_signature(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_signature(text) TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_issue_token(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_jti uuid := gen_random_uuid();
  v_exp bigint;
  v_expires timestamptz;
  v_body text;
BEGIN
  UPDATE public.ether_id_tokens
  SET revoked_at = now()
  WHERE user_id = p_user_id
    AND revoked_at IS NULL;

  v_exp := extract(epoch FROM (now() + interval '30 days'))::bigint;
  v_expires := to_timestamp(v_exp);

  INSERT INTO public.ether_id_tokens (jti, user_id, expires_at)
  VALUES (v_jti, p_user_id, v_expires);

  v_body := v_jti::text || '.' || v_exp::text;

  UPDATE public.ether_id_passes
  SET updated_at = now()
  WHERE user_id = p_user_id;

  RETURN 'eid1.' || v_body || '.' || public.ether_id_signature(v_body);
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_issue_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_issue_token(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_current_token(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_jti uuid;
  v_expires timestamptz;
  v_exp bigint;
  v_body text;
BEGIN
  SELECT jti, expires_at
  INTO v_jti, v_expires
  FROM public.ether_id_tokens
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND expires_at > now() + interval '1 day'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_jti IS NULL THEN
    RETURN public.ether_id_issue_token(p_user_id);
  END IF;

  v_exp := extract(epoch FROM v_expires)::bigint;
  v_body := v_jti::text || '.' || v_exp::text;
  RETURN 'eid1.' || v_body || '.' || public.ether_id_signature(v_body);
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_current_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_current_token(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_user_from_token(p_token text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_jti text;
  v_exp text;
  v_sig text;
  v_jti_uuid uuid;
  v_exp_int bigint;
  v_user uuid;
  v_expires timestamptz;
  v_revoked timestamptz;
BEGIN
  IF p_token IS NULL OR split_part(p_token, '.', 1) <> 'eid1' THEN
    RETURN NULL;
  END IF;
  v_jti := split_part(p_token, '.', 2);
  v_exp := split_part(p_token, '.', 3);
  v_sig := split_part(p_token, '.', 4);
  IF v_jti = '' OR v_exp = '' OR v_sig = '' OR split_part(p_token, '.', 5) <> '' THEN
    RETURN NULL;
  END IF;
  IF public.ether_id_signature(v_jti || '.' || v_exp) IS DISTINCT FROM v_sig THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_jti_uuid := v_jti::uuid;
    v_exp_int := v_exp::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN NULL;
  END;

  SELECT user_id, expires_at, revoked_at
  INTO v_user, v_expires, v_revoked
  FROM public.ether_id_tokens
  WHERE jti = v_jti_uuid;

  IF v_user IS NULL OR v_revoked IS NOT NULL OR v_expires <= now() THEN
    RETURN NULL;
  END IF;
  IF abs(extract(epoch FROM v_expires) - v_exp_int) > 2 THEN
    RETURN NULL;
  END IF;
  RETURN v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_user_from_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_user_from_token(text) TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_public_card(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_username text;
  v_avatar text;
  v_created timestamptz;
  v_status text;
BEGIN
  SELECT
    p.display_name,
    p.username,
    p.avatar_url,
    p.created_at,
    public.ether_member_status(p.access_status, p.is_suspended, p.onboarding_completed, p.last_active_at)
  INTO v_name, v_username, v_avatar, v_created, v_status
  FROM public.profiles p
  WHERE p.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'display_name', v_name,
    'username', v_username,
    'avatar_url', v_avatar,
    'status', v_status,
    'member_since', to_char(v_created, 'YYYY-MM-DD'),
    'member_since_label', to_char(v_created, 'FMMonth YYYY')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_public_card(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_public_card(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_owner_card(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_public jsonb;
  v_passion text;
  v_avg numeric;
  v_count integer;
  v_projects integer;
  v_month smallint;
  v_day smallint;
  v_show boolean;
  v_birthday text;
  v_review_label text;
BEGIN
  v_public := public.ether_id_public_card(p_user_id);
  IF v_public IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(NULLIF(btrim(up.custom_name), ''), pa.name)
  INTO v_passion
  FROM public.user_passions up
  LEFT JOIN public.passions pa ON pa.id = up.passion_id
  WHERE up.user_id = p_user_id
  ORDER BY up.created_at ASC, up.id ASC
  LIMIT 1;

  SELECT round(avg(rating)::numeric, 1), COUNT(*)::integer
  INTO v_avg, v_count
  FROM public.user_reviews
  WHERE reviewed_user_id = p_user_id;

  IF v_count = 0 THEN
    v_avg := NULL;
    v_review_label := 'No peer reviews';
  ELSE
    v_review_label := trim(to_char(v_avg, 'FM990.0'))
      || ' average · '
      || v_count::text
      || CASE WHEN v_count = 1 THEN ' review' ELSE ' reviews' END;
  END IF;

  SELECT COUNT(DISTINCT p.id)::integer
  INTO v_projects
  FROM public.projects p
  WHERE p.status = 'completed'
    AND (
      p.creator_id = p_user_id
      OR EXISTS (
        SELECT 1
        FROM public.project_applications pa
        WHERE pa.project_id = p.id
          AND pa.applicant_id = p_user_id
          AND pa.status = 'accepted'
      )
    );

  SELECT birthday_month, birthday_day, show_birthday
  INTO v_month, v_day, v_show
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_show AND v_month IS NOT NULL AND v_day IS NOT NULL THEN
    v_birthday := to_char(make_date(2024, v_month::int, v_day::int), 'FMMonth FMDD');
  ELSE
    v_birthday := NULL;
  END IF;

  RETURN v_public || jsonb_build_object(
    'passion', v_passion,
    'peer_review_average', v_avg,
    'peer_review_count', v_count,
    'peer_review_label', v_review_label,
    'projects_completed', v_projects,
    'projects_label', v_projects::text || ' completed',
    'birthday_label', v_birthday,
    'birthday_note', CASE WHEN v_birthday IS NULL THEN NULL ELSE 'self-reported' END,
    'show_birthday', COALESCE(v_show, false),
    'birthday_month', v_month,
    'birthday_day', v_day
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_owner_card(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_owner_card(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_my_ether_id_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN public.ether_id_issue_token(v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_my_ether_id_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_my_ether_id_token() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_ether_id()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_card jsonb;
  v_token text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  v_card := public.ether_id_owner_card(v_uid);
  IF v_card IS NULL THEN
    RETURN NULL;
  END IF;
  v_token := public.ether_id_current_token(v_uid);
  RETURN v_card || jsonb_build_object(
    'token', v_token,
    'verify_path', '/id/v/' || v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_ether_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_ether_id() TO authenticated, service_role;

-- Anon verify path. Keyed by the signed token. No user id in, no user id out.
CREATE OR REPLACE FUNCTION public.get_ether_id_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
BEGIN
  v_user := public.ether_id_user_from_token(p_token);
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN public.ether_id_public_card(v_user);
END;
$$;

REVOKE ALL ON FUNCTION public.get_ether_id_by_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ether_id_by_token(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- PassKit rows. The browser may create its own pass row. Device calls and
-- the service card are service_role only (the edge function).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_ether_id_pass(p_pass_type_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_serial text;
  v_auth text;
  v_type text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_pass_type_id IS NULL OR btrim(p_pass_type_id) = '' THEN
    RAISE EXCEPTION 'pass type id required' USING ERRCODE = '23514';
  END IF;

  SELECT serial_number, auth_token, pass_type_identifier
  INTO v_serial, v_auth, v_type
  FROM public.ether_id_passes
  WHERE user_id = v_uid;

  IF v_serial IS NOT NULL THEN
    IF v_type IS DISTINCT FROM p_pass_type_id THEN
      UPDATE public.ether_id_passes
      SET pass_type_identifier = p_pass_type_id,
          updated_at = now()
      WHERE user_id = v_uid;
    END IF;
  ELSE
    v_serial := 'eid_' || encode(extensions.gen_random_bytes(16), 'hex');
    v_auth := encode(extensions.gen_random_bytes(32), 'hex');
    INSERT INTO public.ether_id_passes (user_id, serial_number, auth_token, pass_type_identifier)
    VALUES (v_uid, v_serial, v_auth, p_pass_type_id);
  END IF;

  RETURN jsonb_build_object(
    'serial_number', v_serial,
    'authentication_token', v_auth,
    'pass_type_identifier', p_pass_type_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_ether_id_pass(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ether_id_pass(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ether_id_card_for_service(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_card jsonb;
  v_token text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  v_card := public.ether_id_owner_card(p_user_id);
  IF v_card IS NULL THEN
    RETURN NULL;
  END IF;
  v_token := public.ether_id_current_token(p_user_id);
  RETURN v_card || jsonb_build_object(
    'token', v_token,
    'verify_path', '/id/v/' || v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_card_for_service(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_card_for_service(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_pass_by_serial(
  p_serial text,
  p_auth_token text,
  p_pass_type_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_updated timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT user_id, updated_at
  INTO v_user, v_updated
  FROM public.ether_id_passes
  WHERE serial_number = p_serial
    AND pass_type_identifier = p_pass_type_id
    AND auth_token = p_auth_token;

  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user,
    'updated_tag', trunc(extract(epoch FROM v_updated))::bigint::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_pass_by_serial(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_pass_by_serial(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_register_device(
  p_serial text,
  p_auth_token text,
  p_pass_type_id text,
  p_device text,
  p_push_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_existed boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_user
  FROM public.ether_id_passes
  WHERE serial_number = p_serial
    AND pass_type_identifier = p_pass_type_id
    AND auth_token = p_auth_token;

  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT true INTO v_existed
  FROM public.ether_id_registrations
  WHERE device_library_identifier = p_device
    AND pass_type_identifier = p_pass_type_id
    AND serial_number = p_serial;

  INSERT INTO public.ether_id_registrations (
    device_library_identifier, pass_type_identifier, serial_number, push_token, user_id
  ) VALUES (
    p_device, p_pass_type_id, p_serial, p_push_token, v_user
  )
  ON CONFLICT (device_library_identifier, pass_type_identifier, serial_number)
  DO UPDATE SET push_token = EXCLUDED.push_token, registered_at = now();

  RETURN NOT COALESCE(v_existed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_register_device(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_register_device(text, text, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_unregister_device(
  p_serial text,
  p_auth_token text,
  p_pass_type_id text,
  p_device text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_user
  FROM public.ether_id_passes
  WHERE serial_number = p_serial
    AND pass_type_identifier = p_pass_type_id
    AND auth_token = p_auth_token;

  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.ether_id_registrations
  WHERE device_library_identifier = p_device
    AND pass_type_identifier = p_pass_type_id
    AND serial_number = p_serial;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_unregister_device(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_unregister_device(text, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_updated_serials(
  p_device text,
  p_pass_type_id text,
  p_since text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_since timestamptz;
  v_serials jsonb;
  v_tag text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF p_since IS NOT NULL AND p_since ~ '^[0-9]+$' THEN
    v_since := to_timestamp(p_since::double precision);
  END IF;

  SELECT COALESCE(jsonb_agg(p.serial_number ORDER BY p.serial_number), '[]'::jsonb),
         COALESCE(max(trunc(extract(epoch FROM p.updated_at)))::bigint::text, p_since)
  INTO v_serials, v_tag
  FROM public.ether_id_registrations r
  JOIN public.ether_id_passes p
    ON p.serial_number = r.serial_number
   AND p.pass_type_identifier = r.pass_type_identifier
  WHERE r.device_library_identifier = p_device
    AND r.pass_type_identifier = p_pass_type_id
    AND (v_since IS NULL OR p.updated_at > v_since);

  RETURN jsonb_build_object(
    'lastUpdated', COALESCE(v_tag, '0'),
    'serialNumbers', COALESCE(v_serials, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_updated_serials(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_updated_serials(text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_pending_pushes()
RETURNS TABLE (queue_id bigint, push_token text, pass_type_identifier text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT q.id, r.push_token, p.pass_type_identifier
  FROM public.ether_id_push_queue q
  JOIN public.ether_id_passes p ON p.user_id = q.user_id AND p.serial_number = q.serial_number
  JOIN public.ether_id_registrations r
    ON r.serial_number = p.serial_number
   AND r.pass_type_identifier = p.pass_type_identifier
  WHERE q.sent_at IS NULL
    AND auth.role() = 'service_role'
  ORDER BY q.id
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.ether_id_pending_pushes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_pending_pushes() TO service_role;

CREATE OR REPLACE FUNCTION public.ether_id_mark_pushes(p_ids bigint[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ether_id_push_queue
  SET sent_at = now()
  WHERE id = ANY (COALESCE(p_ids, ARRAY[]::bigint[]))
    AND sent_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_mark_pushes(bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_mark_pushes(bigint[]) TO service_role;

-- ---------------------------------------------------------------------------
-- Status change queues a Wallet update and pings the edge function when
-- ether_id_runtime.push_url and push_secret are set. A missing pg_net
-- must not block the ban. The verify page reads profiles directly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ether_id_on_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old text;
  v_new text;
  v_url text;
  v_secret text;
BEGIN
  v_old := public.ether_member_status(
    OLD.access_status, OLD.is_suspended, OLD.onboarding_completed, OLD.last_active_at
  );
  v_new := public.ether_member_status(
    NEW.access_status, NEW.is_suspended, NEW.onboarding_completed, NEW.last_active_at
  );
  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN NEW;
  END IF;

  UPDATE public.ether_id_passes
  SET updated_at = now(),
      last_status = v_new
  WHERE user_id = NEW.user_id;

  INSERT INTO public.ether_id_push_queue (user_id, serial_number, next_status)
  SELECT NEW.user_id, p.serial_number, v_new
  FROM public.ether_id_passes p
  WHERE p.user_id = NEW.user_id;

  SELECT push_url, push_secret INTO v_url, v_secret
  FROM public.ether_id_runtime
  WHERE id = 1;

  IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        body := jsonb_build_object('user_id', NEW.user_id, 'status', v_new),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-ether-id-push-secret', v_secret
        ),
        timeout_milliseconds := 2000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'ether id pass push was not sent: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ether_id_on_profile_status ON public.profiles;
CREATE TRIGGER ether_id_on_profile_status
  AFTER UPDATE OF access_status, is_suspended, onboarding_completed, last_active_at
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ether_id_on_profile_status();

REVOKE ALL ON FUNCTION public.ether_id_on_profile_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_on_profile_status() TO service_role;

-- The scratch RLS check requires every public function to pin search_path.
-- These two predate that rule and are called from Ether ID (username filter
-- and the quest uuid helper the suite already loads).
ALTER FUNCTION public.novi_quest_uuid(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.objectionable_text(text) SET search_path = public, pg_temp;
