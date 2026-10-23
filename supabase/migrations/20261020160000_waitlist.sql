-- Pre-launch waitlist. Do not apply this file from the app. Cadre applies it.
-- anon cannot select, update, or delete. Inserts go only through join_waitlist.
-- The function returns one ref code and no other row data.

CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  ig_handle text,
  what_do_you_make text,
  email_me boolean NOT NULL,
  src text NOT NULL,
  ref_code text NOT NULL,
  referred_by text,
  founding boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_email_key UNIQUE (email),
  CONSTRAINT waitlist_ref_code_key UNIQUE (ref_code),
  CONSTRAINT waitlist_src_check CHECK (
    src IN ('oct27', 'ig', 'dm', 'slack', 'familcy', 'sponsor', 'nuance', 'manifest', 'direct')
  ),
  CONSTRAINT waitlist_email_me_check CHECK (email_me)
);

COMMENT ON TABLE public.waitlist IS
  'Pre-launch waitlist. No anon select, update, or delete. join_waitlist is the only insert path and returns only a ref code.';

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.waitlist FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.waitlist TO service_role;

CREATE OR REPLACE FUNCTION public.join_waitlist(
  p_name text,
  p_email text,
  p_email_me boolean,
  p_ig_handle text DEFAULT NULL,
  p_what_do_you_make text DEFAULT NULL,
  p_src text DEFAULT NULL,
  p_ref text DEFAULT NULL,
  p_company text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ig text := regexp_replace(btrim(coalesce(p_ig_handle, '')), '^@+', '');
  v_what text := btrim(coalesce(p_what_do_you_make, ''));
  v_src text := lower(btrim(coalesce(p_src, '')));
  v_ref text := lower(btrim(coalesce(p_ref, '')));
  v_code text;
  v_existing text;
  attempt integer;
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  i integer;
  n integer;
BEGIN
  -- Honeypot. A filled field is dropped and the caller still gets a code-shaped
  -- response so the form cannot tell a bot apart from a saved row.
  IF btrim(coalesce(p_company, '')) <> '' THEN
    v_code := '';
    FOR i IN 1..8 LOOP
      n := 1 + floor(random() * length(alphabet))::integer;
      v_code := v_code || substr(alphabet, n, 1);
    END LOOP;
    RETURN v_code;
  END IF;

  IF v_name = '' OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'name required';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;
  IF char_length(v_email) > 255 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;
  IF p_email_me IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'email_me required';
  END IF;
  IF v_ig <> '' AND (char_length(v_ig) > 30 OR v_ig !~ '^[A-Za-z0-9._]+$') THEN
    RAISE EXCEPTION 'invalid ig';
  END IF;
  IF char_length(v_what) > 280 THEN
    RAISE EXCEPTION 'what do you make is too long';
  END IF;

  IF v_src NOT IN ('oct27', 'ig', 'dm', 'slack', 'familcy', 'sponsor', 'nuance', 'manifest') THEN
    v_src := 'direct';
  END IF;
  IF v_ref = '' OR v_ref !~ '^[a-z0-9]{6,16}$' THEN
    v_ref := NULL;
  END IF;
  IF v_ig = '' THEN
    v_ig := NULL;
  END IF;
  IF v_what = '' THEN
    v_what := NULL;
  END IF;

  FOR attempt IN 1..8 LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      n := 1 + floor(random() * length(alphabet))::integer;
      v_code := v_code || substr(alphabet, n, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.waitlist (
        name, email, ig_handle, what_do_you_make, email_me, src, ref_code, referred_by, founding
      ) VALUES (
        v_name, v_email, v_ig, v_what, true, v_src, v_code, v_ref, true
      );
      RETURN v_code;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT w.ref_code INTO v_existing
        FROM public.waitlist w
        WHERE w.email = v_email;
        IF v_existing IS NOT NULL THEN
          RETURN v_existing;
        END IF;
    END;
  END LOOP;

  RAISE EXCEPTION 'waitlist unavailable';
END;
$fn$;

COMMENT ON FUNCTION public.join_waitlist(text, text, boolean, text, text, text, text, text) IS
  'Validates a waitlist row and returns only that person''s ref code. Duplicate emails return the same code and do not say the address was already stored. A honeypot value is not stored.';

REVOKE ALL ON FUNCTION public.join_waitlist(text, text, boolean, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_waitlist(text, text, boolean, text, text, text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.export_waitlist(
  p_src text DEFAULT NULL,
  p_week date DEFAULT NULL
)
RETURNS TABLE (
  src text,
  name text,
  email text,
  ig_handle text,
  what_do_you_make text,
  email_me boolean,
  ref_code text,
  referred_by text,
  founding boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_src text := lower(btrim(coalesce(p_src, '')));
  v_week date := coalesce(p_week, current_date);
  v_start timestamptz := date_trunc('week', v_week::timestamp);
  v_end timestamptz := v_start + interval '7 days';
BEGIN
  IF coalesce(auth.role(), '') IS DISTINCT FROM 'service_role'
     AND NOT coalesce(public.has_role(auth.uid(), 'admin'), false) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF v_src <> '' AND v_src NOT IN ('oct27', 'ig', 'dm', 'slack', 'familcy', 'sponsor', 'nuance', 'manifest', 'direct') THEN
    RAISE EXCEPTION 'invalid src';
  END IF;

  RETURN QUERY
  SELECT
    w.src,
    w.name,
    w.email,
    w.ig_handle,
    w.what_do_you_make,
    w.email_me,
    w.ref_code,
    w.referred_by,
    w.founding,
    w.created_at
  FROM public.waitlist w
  WHERE w.created_at >= v_start
    AND w.created_at < v_end
    AND (v_src = '' OR w.src = v_src)
  ORDER BY w.src, w.created_at;
END;
$fn$;

COMMENT ON FUNCTION public.export_waitlist(text, date) IS
  'Admin or service_role weekly export. Rows are ordered by src. p_src filters one source. p_week defaults to the current week.';

REVOKE ALL ON FUNCTION public.export_waitlist(text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_waitlist(text, date) TO authenticated, service_role;
