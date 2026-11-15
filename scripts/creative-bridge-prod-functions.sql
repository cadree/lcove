-- ether-prod's own definitions (pg_get_functiondef / pg_policies, read 2026-11-15) of the rules the
-- creative-bridge migrations lean on. Loaded by scripts/creative-bridge-fixture.mjs. Do not edit by hand.
CREATE OR REPLACE FUNCTION public.admin_apply_report_target(p_target_type text, p_target_id uuid, p_action text, p_reason text, p_confirm text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  owner_id uuid;
BEGIN
  IF p_action = 'hard_delete' AND p_confirm IS DISTINCT FROM p_target_id::text THEN
    RAISE EXCEPTION 'Hard delete requires a second confirmation of the target id'
      USING ERRCODE = '42501';
  END IF;

  IF p_target_type = 'post' THEN
    SELECT user_id INTO owner_id FROM public.posts WHERE id = p_target_id;
    PERFORM public.admin_moderate_content('post', p_target_id, p_action, p_reason, p_confirm, false);
    RETURN owner_id;
  ELSIF p_target_type = 'comment' AND to_regclass('public.post_comments') IS NOT NULL THEN
    SELECT user_id INTO owner_id FROM public.post_comments WHERE id = p_target_id;
    IF owner_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.post_comments WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hide' THEN
      UPDATE public.post_comments SET hidden_at = COALESCE(hidden_at, now()) WHERE id = p_target_id;
    ELSIF p_action IN ('remove', 'unhide') THEN
      UPDATE public.post_comments
        SET removed_at = CASE WHEN p_action = 'remove' THEN COALESCE(removed_at, now()) ELSE NULL END,
            hidden_at = CASE WHEN p_action = 'remove' THEN COALESCE(hidden_at, now()) ELSE NULL END
        WHERE id = p_target_id;
    ELSIF p_action = 'restore' THEN
      UPDATE public.post_comments SET removed_at = NULL, hidden_at = NULL WHERE id = p_target_id;
    ELSIF p_action = 'hard_delete' THEN
      DELETE FROM public.post_comments WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSIF p_target_type = 'message' AND to_regclass('public.messages') IS NOT NULL THEN
    SELECT sender_id INTO owner_id FROM public.messages WHERE id = p_target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hard_delete' THEN
      DELETE FROM public.messages WHERE id = p_target_id;
    ELSE
      UPDATE public.messages
        SET deleted_at = now(), content = NULL
        WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSIF p_target_type = 'profile' THEN
    IF p_action = 'hide' THEN
      PERFORM public.admin_set_user_access(p_target_id, 'suspend', p_reason);
    ELSIF p_action = 'remove' THEN
      PERFORM public.admin_remove_user(p_target_id, p_reason, false, NULL);
    ELSIF p_action = 'hard_delete' THEN
      PERFORM public.admin_remove_user(p_target_id, p_reason, true, p_confirm);
    END IF;
    RETURN p_target_id;
  ELSIF p_target_type = 'project' AND to_regclass('public.projects') IS NOT NULL THEN
    SELECT creator_id INTO owner_id FROM public.projects WHERE id = p_target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hide' THEN
      UPDATE public.projects SET hidden_at = COALESCE(hidden_at, now()) WHERE id = p_target_id;
    ELSIF p_action = 'remove' THEN
      UPDATE public.projects
        SET removed_at = COALESCE(removed_at, now()),
            hidden_at = COALESCE(hidden_at, now())
        WHERE id = p_target_id;
    ELSIF p_action = 'hard_delete' THEN
      DELETE FROM public.projects WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSIF p_target_type = 'stream' AND to_regclass('public.live_streams') IS NOT NULL THEN
    SELECT host_id INTO owner_id FROM public.live_streams WHERE id = p_target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hard_delete' THEN
      DELETE FROM public.live_streams WHERE id = p_target_id;
    ELSE
      UPDATE public.live_streams
        SET is_live = false,
            ended_at = COALESCE(ended_at, now()),
            title = CASE WHEN p_action = 'remove' THEN 'Removed' ELSE title END
        WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSIF p_target_type = 'stream_message' AND to_regclass('public.stream_chat') IS NOT NULL THEN
    SELECT user_id INTO owner_id FROM public.stream_chat WHERE id = p_target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hard_delete' THEN
      DELETE FROM public.stream_chat WHERE id = p_target_id;
    ELSE
      UPDATE public.stream_chat
        SET removed_at = COALESCE(removed_at, now())
        WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSE
    RAISE EXCEPTION 'This report target cannot be moderated that way';
  END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_project(p_project_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        (p.is_private = false AND p.status IN ('open', 'in_progress', 'completed'))
        OR (
          p_user_id IS NOT NULL
          AND p_user_id IS NOT DISTINCT FROM auth.uid()
          AND (
            p.creator_id = p_user_id
            OR EXISTS (
              SELECT 1
              FROM public.project_applications pa
              WHERE pa.project_id = p.id
                AND pa.applicant_id = p_user_id
                AND pa.status = 'accepted'
            )
            OR EXISTS (
              SELECT 1
              FROM public.project_clients pc
              WHERE pc.project_id = p.id
                AND pc.client_user_id = p_user_id
                AND pc.status IN ('invited', 'accepted')
            )
          )
        )
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.discovery_eligible(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.profiles_public p WHERE p.user_id=u AND p.onboarding_completed
 AND p.access_status IS DISTINCT FROM 'banned' AND NOT coalesce(p.is_suspended,false))
 AND NOT public.discovery_hidden(u);
$function$
;
CREATE OR REPLACE FUNCTION public.discovery_hidden(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.discovery_preferences WHERE user_id=u AND NOT discoverable);
$function$
;
CREATE OR REPLACE FUNCTION public.either_blocked(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a IS NOT NULL
    AND b IS NOT NULL
    AND a <> b
    AND (
      public.has_blocked(a, b)
      OR public.has_blocked(b, a)
    );
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_report_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to report'
      USING ERRCODE = '42501';
  END IF;

  NEW.reporter_id := auth.uid();
  NEW.status := 'open';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_application_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE public.project_roles 
    SET slots_filled = slots_filled + 1,
        is_locked = CASE WHEN slots_filled + 1 >= slots_available THEN true ELSE is_locked END
    WHERE id = NEW.role_id;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_blocked(blocker uuid, blocked uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks
    WHERE blocker_id = blocker
      AND blocked_id = blocked
  );
$function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;
CREATE OR REPLACE FUNCTION public.is_project_creator(p_project_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND creator_id = p_user_id
  )
$function$
;
CREATE OR REPLACE FUNCTION public.objectionable_text(input text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  normalized text;
  token text;
  banned text[] := ARRAY[
    'porn', 'porno', 'xxx', 'nude', 'nudes', 'slut', 'whore',
    'faggot', 'nigger', 'nigga', 'retard', 'kike'
  ];
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN
    RETURN false;
  END IF;

  normalized := lower(input);
  normalized := replace(normalized, '0', 'o');
  normalized := replace(normalized, '1', 'i');
  normalized := replace(normalized, '3', 'e');
  normalized := replace(normalized, '4', 'a');
  normalized := replace(normalized, '5', 's');
  normalized := replace(normalized, '@', 'a');
  normalized := replace(normalized, '$', 's');
  normalized := regexp_replace(normalized, '[^a-z]+', ' ', 'g');
  normalized := btrim(regexp_replace(normalized, '\s+', ' ', 'g'));

  IF normalized ~ '(^| )kill yourself( |$)' THEN
    RETURN true;
  END IF;

  FOREACH token IN ARRAY regexp_split_to_array(normalized, ' ')
  LOOP
    IF token = ANY (banned) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.protect_moderation_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  held boolean;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon', 'authenticator') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    held := (to_jsonb(OLD) ? 'hidden_at' AND to_jsonb(OLD)->>'hidden_at' IS NOT NULL)
      OR (to_jsonb(OLD) ? 'removed_at' AND to_jsonb(OLD)->>'removed_at' IS NOT NULL);
    IF held THEN
      RAISE EXCEPTION 'An admin is holding this'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF (to_jsonb(NEW) ? 'hidden_at' AND NEW.hidden_at IS DISTINCT FROM OLD.hidden_at)
    OR (to_jsonb(NEW) ? 'removed_at' AND NEW.removed_at IS DISTINCT FROM OLD.removed_at)
  THEN
    RAISE EXCEPTION 'Only an admin can change visibility'
      USING ERRCODE = '42501';
  END IF;

  -- Nested so is_active is only read on store_items. PL/pgSQL does not
  -- short-circuit AND, and other tables have no is_active field.
  IF TG_TABLE_NAME = 'store_items' THEN
    IF (OLD.hidden_at IS NOT NULL OR OLD.removed_at IS NOT NULL)
      AND NEW.is_active IS DISTINCT FROM OLD.is_active
    THEN
      RAISE EXCEPTION 'An admin is holding this item'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.reject_inactive_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  standing public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO standing FROM public.profiles WHERE user_id = auth.uid();
  IF standing.deleted_at IS NOT NULL
    OR standing.access_status = 'banned'
    OR COALESCE(standing.is_suspended, false)
  THEN
    RAISE EXCEPTION 'This account is not allowed to do that'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$
;
