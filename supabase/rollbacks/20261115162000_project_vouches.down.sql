-- Undo 20261115162000_project_vouches.sql. Revert the app commit first.
-- Roll back 20261115163000_open_calls first if it is applied.
-- Vouch notices already sent stay in notifications (type vouch).
-- Reports already filed against vouches stay; the target-type check comes
-- back NOT VALID so those rows are kept, and admins can still dismiss them.
DROP FUNCTION IF EXISTS public.profile_vouches(uuid);
DROP FUNCTION IF EXISTS public.project_wrap_up(uuid);
DROP FUNCTION IF EXISTS public.vouch_for(uuid, uuid, text);
DROP TABLE IF EXISTS public.project_vouches;
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type = ANY (ARRAY['post'::text, 'profile'::text, 'message'::text, 'comment'::text, 'project'::text, 'stream_message'::text, 'stream'::text, 'event'::text])) NOT VALID;
-- prod's admin_apply_report_target as it was before this migration.
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
$function$;
