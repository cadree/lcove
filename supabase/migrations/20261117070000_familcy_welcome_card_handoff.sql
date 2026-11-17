-- Durable, one-time approval experience. The user's approval, card registration,
-- and entry into Explore survive closing the browser or native app.
BEGIN;

ALTER TABLE public.member_acceptance_events
  ADD COLUMN IF NOT EXISTS card_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_my_familcy_welcome_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_build_object(
      'needs_setup', (a.welcome_completed_at IS NULL),
      'card_registered', (a.card_registered_at IS NOT NULL)
    )
    FROM public.member_acceptance_events a
    JOIN public.profiles p ON p.user_id=a.applicant_user_id
    WHERE a.applicant_user_id=v_uid
      AND p.onboarding_completed IS TRUE
      AND p.access_status='active'
  ), '{"needs_setup":false,"card_registered":false}'::jsonb);
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_my_familcy_welcome_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_familcy_welcome_status() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.register_my_ether_card()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id=v_uid AND p.access_status='active' AND p.onboarding_completed
      AND p.username ~ '^[a-z0-9_]{3,20}$'
      AND nullif(btrim(p.passion_title),'') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Save a username and a creative passion to register your ETHER Card'
      USING ERRCODE='23514';
  END IF;
  UPDATE public.member_acceptance_events
  SET card_registered_at=coalesce(card_registered_at,now())
  WHERE applicant_user_id=v_uid AND welcome_completed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending welcome found for this account' USING ERRCODE='23514';
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.register_my_ether_card() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_my_ether_card() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.complete_my_familcy_welcome()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_acceptance_events a
    JOIN public.profiles p ON p.user_id=a.applicant_user_id
    WHERE a.applicant_user_id=v_uid
      AND a.card_registered_at IS NOT NULL
      AND p.access_status='active' AND p.onboarding_completed
  ) THEN
    RAISE EXCEPTION 'Register your ETHER Card before entering Explore'
      USING ERRCODE='23514';
  END IF;
  UPDATE public.member_acceptance_events
  SET welcome_completed_at=coalesce(welcome_completed_at,now())
  WHERE applicant_user_id=v_uid;
END;
$fn$;
REVOKE ALL ON FUNCTION public.complete_my_familcy_welcome() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_my_familcy_welcome() TO authenticated,service_role;

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
  VALUES(NEW.user_id,'membership_accepted','Welcome to the Familcy',
    'Your application was accepted. Register your ETHER Card to enter.',
    jsonb_build_object('path','/welcome','applicant_id',NEW.user_id));

  SELECT lower(u.email) INTO v_applicant_email FROM auth.users u
   WHERE u.id=NEW.user_id AND u.email_confirmed_at IS NOT NULL;
  IF v_applicant_email IS NOT NULL THEN
    v_key:='ether-member-welcome-'||NEW.user_id::text;
    PERFORM pgmq.send('transactional_emails',jsonb_build_object(
      'message_id',v_key,'idempotency_key',v_key,'to',v_applicant_email,
      'subject','Welcome to the Familcy',
      'text','Welcome to the Familcy.'||E'\n\n'||
        'Your application has been accepted. Register your ETHER Card and add it to your wallet.'||
        E'\n\nContinue: https://etherbylcove.com/welcome',
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
COMMIT;
