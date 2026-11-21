-- Member-to-member introductions are distinct from project wrap-up vouches.
-- A referral records an introduction; it never grants membership or bypasses review.
BEGIN;

CREATE TABLE public.member_referral_codes (
  sponsor_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_referral_codes_shape CHECK (code ~ '^[0-9a-f]{32}$')
);
ALTER TABLE public.member_referral_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_referral_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_referral_codes TO service_role;

CREATE TABLE public.member_referrals (
  applicant_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sponsor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  introduction_kind text NOT NULL CHECK (introduction_kind IN ('vouch', 'referral')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT member_referrals_no_self_referral CHECK (applicant_user_id <> sponsor_user_id)
);
CREATE INDEX member_referrals_sponsor_idx ON public.member_referrals(sponsor_user_id, created_at DESC);
ALTER TABLE public.member_referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_referrals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_referrals TO service_role;

CREATE TABLE public.member_acceptance_events (
  applicant_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_acceptance_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_acceptance_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.member_acceptance_events TO service_role;

-- One stable shareable link for an applicant or active member. No referral
-- codes for banned/denied members or people who never completed onboarding.
CREATE OR REPLACE FUNCTION public.get_my_member_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_uid uuid := (SELECT auth.uid()); v_code text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id=v_uid
      AND p.onboarding_completed IS TRUE
      AND p.access_status IN ('active','pending')
  ) THEN RAISE EXCEPTION 'Only active members and applicants awaiting approval can invite creatives' USING ERRCODE='42501'; END IF;

  INSERT INTO public.member_referral_codes(sponsor_user_id)
  VALUES (v_uid)
  ON CONFLICT (sponsor_user_id) DO NOTHING;

  SELECT c.code INTO v_code FROM public.member_referral_codes c WHERE c.sponsor_user_id=v_uid;
  RETURN v_code;
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_my_member_referral_code() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_member_referral_code() TO authenticated,service_role;

-- A referral-link preview reveals no applicant information or email addresses.
CREATE OR REPLACE FUNCTION public.preview_member_referral(p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
  SELECT jsonb_build_object(
    'name', left(coalesce(nullif(btrim(p.display_name),''),'An ETHER creative'),60),
    'kind', CASE WHEN p.access_status='active' THEN 'vouch' ELSE 'referral' END
  )
  FROM public.member_referral_codes c
  JOIN public.profiles p ON p.user_id=c.sponsor_user_id
  WHERE c.code=p_code AND p.onboarding_completed IS TRUE
    AND p.access_status IN ('active','pending')
    AND length(p_code)=32
  LIMIT 1;
$fn$;
REVOKE ALL ON FUNCTION public.preview_member_referral(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preview_member_referral(text) TO anon,authenticated,service_role;

-- Only derived from the token supplied at signup and checked against the
-- real sponsor's profile. The user can edit metadata but cannot rewrite a
-- stored introduction or create acceptance.
CREATE OR REPLACE FUNCTION public.ether_record_member_referral_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_code text := coalesce(NEW.raw_user_meta_data->>'ether_referral_code','');
        v_sponsor uuid; v_kind text;
BEGIN
  IF length(v_code)<>32 OR v_code !~ '^[0-9a-f]{32}$' THEN RETURN NEW; END IF;
  SELECT c.sponsor_user_id,
    CASE WHEN p.access_status='active' THEN 'vouch' ELSE 'referral' END
  INTO v_sponsor,v_kind
  FROM public.member_referral_codes c
  JOIN public.profiles p ON p.user_id=c.sponsor_user_id
  WHERE c.code=v_code AND p.onboarding_completed IS TRUE
    AND p.access_status IN ('active','pending') AND c.sponsor_user_id<>NEW.id;
  IF v_sponsor IS NOT NULL THEN
    INSERT INTO public.member_referrals(applicant_user_id,sponsor_user_id,introduction_kind)
    VALUES(NEW.id,v_sponsor,v_kind)
    ON CONFLICT (applicant_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS z_ether_member_referral_signup ON auth.users;
CREATE TRIGGER z_ether_member_referral_signup
 AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.ether_record_member_referral_signup();
REVOKE ALL ON FUNCTION public.ether_record_member_referral_signup() FROM PUBLIC,anon,authenticated;

-- Approval is a one-time event, even if a later moderator edits the account.
-- The applicant receives a lasting in-app Familcy welcome and an email.
-- Their sponsor receives an in-app notice and an email, including when the
-- sponsor is themselves still awaiting approval (in-app notice is retained).
CREATE OR REPLACE FUNCTION public.ether_notify_member_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_new uuid; v_sponsor uuid; v_kind text;
        v_applicant_email text; v_sponsor_email text;
        v_name text := left(coalesce(nullif(btrim(NEW.display_name),''),'A creative'),80);
        v_key text;
BEGIN
  IF OLD.access_status IS DISTINCT FROM 'pending'
    OR NEW.access_status IS DISTINCT FROM 'active'
    OR NEW.onboarding_completed IS DISTINCT FROM TRUE THEN RETURN NEW; END IF;

  INSERT INTO public.member_acceptance_events(applicant_user_id)
  VALUES (NEW.user_id) ON CONFLICT DO NOTHING RETURNING applicant_user_id INTO v_new;
  IF v_new IS NULL THEN RETURN NEW; END IF;

  SELECT r.sponsor_user_id,r.introduction_kind INTO v_sponsor,v_kind
  FROM public.member_referrals r WHERE r.applicant_user_id=NEW.user_id;
  UPDATE public.member_referrals SET accepted_at=now()
   WHERE applicant_user_id=NEW.user_id AND accepted_at IS NULL;

  INSERT INTO public.notifications(user_id,type,title,body,data)
  VALUES(NEW.user_id,'membership_accepted','Welcome to ETHER, Familcy.',
    'Your application has been accepted. You belong here. Create, connect, and make something real.',
    jsonb_build_object('path','/feed','applicant_id',NEW.user_id));

  SELECT lower(u.email) INTO v_applicant_email FROM auth.users u
   WHERE u.id=NEW.user_id AND u.email_confirmed_at IS NOT NULL;
  IF v_applicant_email IS NOT NULL THEN
    v_key:='ether-member-welcome-'||NEW.user_id::text;
    PERFORM pgmq.send('transactional_emails',jsonb_build_object(
      'message_id',v_key,'idempotency_key',v_key,'to',v_applicant_email,
      'subject','Welcome to ETHER — you are Familcy',
      'text','Your ETHER application has been accepted.'||E'\n\n'||
        'Welcome to the Familcy. Your creativity belongs here. Connect with other creatives and start making what matters.'||
        E'\n\nEnter ETHER: https://etherbylcove.com/feed',
      'label','ether_member_accepted','queued_at',clock_timestamp()));
  END IF;

  IF v_sponsor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id=v_sponsor AND p.access_status IN ('pending','active')
  ) THEN
    INSERT INTO public.notifications(user_id,type,title,body,data)
    VALUES(v_sponsor,'referral_accepted','Your creative made it into ETHER.',
      v_name||' has been accepted into the Familcy. Thanks for '||
       CASE WHEN v_kind='vouch' THEN 'vouching for' ELSE 'inviting' END||
       ' another creative.',
      jsonb_build_object('path','/feed','applicant_id',NEW.user_id,'kind',v_kind));
    SELECT lower(u.email) INTO v_sponsor_email FROM auth.users u
     WHERE u.id=v_sponsor AND u.email_confirmed_at IS NOT NULL;
    IF v_sponsor_email IS NOT NULL AND v_sponsor_email<>v_applicant_email THEN
      v_key:='ether-member-sponsor-'||NEW.user_id::text;
      PERFORM pgmq.send('transactional_emails',jsonb_build_object(
        'message_id',v_key,'idempotency_key',v_key,'to',v_sponsor_email,
        'subject','Your ETHER creative has been accepted',
        'text',v_name||' was accepted into ETHER.'||E'\n\n'||
          'Thank you for helping another creative find the Familcy.'||
          E'\n\nETHER: https://etherbylcove.com',
        'label','ether_referral_accepted','queued_at',clock_timestamp()));
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS ether_notify_member_accepted ON public.profiles;
CREATE TRIGGER ether_notify_member_accepted
 AFTER UPDATE OF access_status ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.ether_notify_member_accepted();
REVOKE ALL ON FUNCTION public.ether_notify_member_accepted() FROM PUBLIC,anon,authenticated;

COMMIT;
