-- Claim a founder invite from the auth user, not from the browser that opened the email.
-- Additive and idempotent. Safe to apply on a database that already has the waitlist.

CREATE OR REPLACE FUNCTION public.claim_waitlist_invite(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.waitlist%ROWTYPE;
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_ref text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;

  IF v_token = '' THEN
    v_token := btrim(coalesce(auth.jwt() -> 'user_metadata' ->> 'waitlist_invite_token', ''));
  END IF;
  IF v_token = '' THEN
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.waitlist w
  WHERE w.invite_token = v_token
  FOR UPDATE;

  IF NOT FOUND OR v_row.invited_at IS NULL THEN
    RAISE EXCEPTION 'invite not active';
  END IF;
  IF v_row.converted_at IS NOT NULL THEN
    IF v_row.converted_user_id = auth.uid() THEN
      RETURN;
    END IF;
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
  'Single-use. The signed-in email must match the waitlist row. A blank token uses signup user metadata. Claiming again as the same user does nothing.';

-- Account creation claims the invite from signup metadata, before any browser opens the confirmation link.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_token text := btrim(coalesce(NEW.raw_user_meta_data ->> 'waitlist_invite_token', ''));
  v_row public.waitlist%ROWTYPE;
  v_email text := lower(btrim(coalesce(NEW.email, '')));
  v_ref text;
BEGIN
  IF v_token <> '' THEN
    BEGIN
      SELECT * INTO v_row
      FROM public.waitlist
      WHERE invite_token = v_token
        AND converted_at IS NULL
        AND invited_at IS NOT NULL
      FOR UPDATE;

      IF FOUND AND v_email <> '' AND v_email = lower(v_row.email) THEN
        v_ref := coalesce(v_row.referred_by, v_row.ref_code);
        INSERT INTO public.profiles (user_id, founding, signup_src, signup_ref, signup_attribution)
        VALUES (
          NEW.id,
          true,
          v_row.src,
          v_ref,
          jsonb_build_object(
            'src', v_row.src,
            'ref', v_ref,
            'waitlist_ref', v_row.ref_code,
            'founding', true
          )
        );
        UPDATE public.waitlist
        SET converted_at = now(),
            converted_user_id = NEW.id
        WHERE id = v_row.id;
        RETURN NEW;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$fn$;
