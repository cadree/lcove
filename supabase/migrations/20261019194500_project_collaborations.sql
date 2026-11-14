-- Project collaborations: per-role credit, opt-out community alerts,
-- private discovery, calendar hiding, and project subgroups.
--
-- canonical_city_name shipped without a search_path, so the scratch
-- RLS suite stops before these project checks. Pin it without changing
-- the city rules.
ALTER FUNCTION public.canonical_city_name(text) SET search_path = public;

-- Access rules match src/lib/projectCollaborations.ts.
-- can_read_conversation lets the project owner read every project chat,
-- including a subgroup they were not added to. Posting still requires
-- membership. A non-member is neither a participant nor the owner.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS hide_from_calendar boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_listing_type_check
    CHECK (listing_type IN ('project', 'gig'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE public.project_roles
  ADD COLUMN IF NOT EXISTS credit_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS parent_conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS shared_from_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_from_conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS new_gigs_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.notification_preferences
  ALTER COLUMN new_projects_enabled SET DEFAULT true;

-- The old default was opt-in (false), so a community post reached almost nobody.
-- Cadre's rule is opt-out: a new project or gig notifies people until they turn it off.
UPDATE public.notification_preferences
SET new_projects_enabled = true
WHERE new_projects_enabled IS DISTINCT FROM true;

UPDATE public.conversation_participants
SET project_role_name = 'Owner'
WHERE project_role_name = 'Project Creator';

CREATE INDEX IF NOT EXISTS idx_conversations_parent
  ON public.conversations(parent_conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversations_project
  ON public.conversations(project_id);

-- The old index allowed one conversation per project, so a client thread
-- or a subgroup could not be created beside the main chat.
DROP INDEX IF EXISTS public.conversations_project_id_unique;

DO $$
BEGIN
  -- Client chats also have a project id and no parent. They are not the main chat.
  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations
    WHERE project_id IS NOT NULL
      AND parent_conversation_id IS NULL
      AND COALESCE(is_client_chat, false) = false
    GROUP BY project_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_main_project_chat
      ON public.conversations (project_id)
      WHERE project_id IS NOT NULL
        AND parent_conversation_id IS NULL
        AND COALESCE(is_client_chat, false) = false;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Who can see a project
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_view_project(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;

-- Owner reads main chat and every subgroup. Participants read their own chats.
-- The user id is trusted only when it is the signed-in user, so a direct call
-- cannot probe someone else's membership.
CREATE OR REPLACE FUNCTION public.can_read_conversation(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    p_user_id IS NOT NULL
    AND p_user_id IS NOT DISTINCT FROM auth.uid()
    AND (
      public.is_conversation_participant(p_conversation_id, p_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.conversations c
        JOIN public.projects p ON p.id = c.project_id
        WHERE c.id = p_conversation_id
          AND p.creator_id = p_user_id
      )
    );
$fn$;

REVOKE ALL ON FUNCTION public.can_view_project(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_read_conversation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_conversation(uuid, uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Project visibility policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view open projects" ON public.projects;
DROP POLICY IF EXISTS "Private projects visible to creator and clients" ON public.projects;
DROP POLICY IF EXISTS "Projects are visible to the community or their members" ON public.projects;
CREATE POLICY "Projects are visible to the community or their members"
ON public.projects
FOR SELECT
USING (public.can_view_project(id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can view roles of visible projects" ON public.project_roles;
DROP POLICY IF EXISTS "Roles follow project visibility" ON public.project_roles;
CREATE POLICY "Roles follow project visibility"
ON public.project_roles
FOR SELECT
USING (public.can_view_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view project attachments" ON public.project_attachments;
DROP POLICY IF EXISTS "Attachments follow project visibility" ON public.project_attachments;
CREATE POLICY "Attachments follow project visibility"
ON public.project_attachments
FOR SELECT
TO authenticated
USING (public.can_view_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own attachments" ON public.project_attachments;
DROP POLICY IF EXISTS "Project owners attach files" ON public.project_attachments;
CREATE POLICY "Project owners attach files"
ON public.project_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND public.is_project_creator(project_id, auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view project updates" ON public.project_updates;
DROP POLICY IF EXISTS "Updates follow project visibility" ON public.project_updates;
CREATE POLICY "Updates follow project visibility"
ON public.project_updates
FOR SELECT
TO authenticated
USING (public.can_view_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Users can apply to projects" ON public.project_applications;
DROP POLICY IF EXISTS "Users can apply to visible projects" ON public.project_applications;
CREATE POLICY "Users can apply to visible projects"
ON public.project_applications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = applicant_id
  AND public.can_view_project(project_id, auth.uid())
);

-- ---------------------------------------------------------------------------
-- Chats: owner can read subgroups; only members can post or create them
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations they participate in or created" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations they belong to or own" ON public.conversations;
CREATE POLICY "Users can view conversations they belong to or own"
ON public.conversations
FOR SELECT
USING (
  public.is_conversation_participant(id, auth.uid())
  OR created_by = auth.uid()
  OR public.can_read_conversation(id, auth.uid())
);

DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of chats they can read" ON public.conversation_participants;
CREATE POLICY "Users can view participants of chats they can read"
ON public.conversation_participants
FOR SELECT
USING (public.can_read_conversation(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in chats they can read" ON public.messages;
CREATE POLICY "Users can view messages in chats they can read"
ON public.messages
FOR SELECT
USING (
  public.can_read_conversation(conversation_id, auth.uid())
  AND deleted_at IS NULL
  AND NOT public.has_blocked(auth.uid(), sender_id)
);

CREATE OR REPLACE FUNCTION public.enforce_project_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  parent public.conversations%ROWTYPE;
BEGIN
  IF NEW.project_id IS NULL AND NEW.parent_conversation_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Conversation creator must be the signed-in user';
  END IF;

  IF NEW.parent_conversation_id IS NOT NULL THEN
    SELECT * INTO parent FROM public.conversations WHERE id = NEW.parent_conversation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent chat not found';
    END IF;
    IF parent.parent_conversation_id IS NOT NULL THEN
      RAISE EXCEPTION 'Subgroups cannot contain their own subgroups';
    END IF;
    IF COALESCE(parent.is_client_chat, false) THEN
      RAISE EXCEPTION 'Subgroups belong to the main project chat';
    END IF;
    IF parent.project_id IS NULL OR NEW.project_id IS DISTINCT FROM parent.project_id THEN
      RAISE EXCEPTION 'Subgroup must stay on the same project';
    END IF;
    IF NOT (
      public.is_conversation_participant(parent.id, auth.uid())
      OR public.is_project_creator(parent.project_id, auth.uid())
    ) THEN
      RAISE EXCEPTION 'Only project members can open a subgroup';
    END IF;
    NEW.type := 'group';
    NEW.visibility := 'private';
    RETURN NEW;
  END IF;

  IF NOT public.is_project_creator(NEW.project_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the project owner can create the project chat';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS enforce_project_conversation ON public.conversations;
CREATE TRIGGER enforce_project_conversation
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_conversation();

CREATE OR REPLACE FUNCTION public.enforce_project_chat_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  conv public.conversations%ROWTYPE;
BEGIN
  SELECT * INTO conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF conv.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- An invited client can join the private client thread before they accept.
  IF COALESCE(conv.is_client_chat, false) THEN
    IF NOT (
      public.is_project_creator(conv.project_id, NEW.user_id)
      OR NEW.user_id = conv.created_by
      OR EXISTS (
        SELECT 1
        FROM public.project_clients pc
        WHERE pc.project_id = conv.project_id
          AND pc.client_user_id = NEW.user_id
          AND pc.status IN ('invited', 'accepted')
      )
    ) THEN
      RAISE EXCEPTION 'Only the owner and invited clients can join this chat';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    public.is_project_creator(conv.project_id, NEW.user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project_applications pa
      WHERE pa.project_id = conv.project_id
        AND pa.applicant_id = NEW.user_id
        AND pa.status = 'accepted'
    )
    OR public.is_project_client(conv.project_id, NEW.user_id)
    OR NEW.user_id = conv.created_by
  ) THEN
    RAISE EXCEPTION 'Only project members can join this chat';
  END IF;

  IF conv.parent_conversation_id IS NOT NULL THEN
    IF NOT (
      public.is_conversation_participant(conv.parent_conversation_id, NEW.user_id)
      OR public.is_project_creator(conv.project_id, NEW.user_id)
    ) THEN
      RAISE EXCEPTION 'Subgroup members come from the main project chat';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS enforce_project_chat_member ON public.conversation_participants;
CREATE TRIGGER enforce_project_chat_member
  BEFORE INSERT ON public.conversation_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_chat_member();

REVOKE ALL ON FUNCTION public.enforce_project_conversation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_project_chat_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_project_conversation() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_project_chat_member() TO service_role;

-- Copy selected subgroup messages into the main project chat.
CREATE OR REPLACE FUNCTION public.share_messages_to_project_main(p_message_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_source uuid;
  v_main uuid;
  v_project uuid;
  v_count integer := 0;
  v_sources integer;
  r record;
  v_author text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_message_ids IS NULL OR coalesce(array_length(p_message_ids, 1), 0) < 1
     OR array_length(p_message_ids, 1) > 50 THEN
    RAISE EXCEPTION 'Choose between 1 and 50 messages';
  END IF;

  SELECT count(DISTINCT m.conversation_id) INTO v_sources
  FROM public.messages m
  WHERE m.id = ANY(p_message_ids)
    AND m.deleted_at IS NULL;

  IF v_sources <> 1 THEN
    RAISE EXCEPTION 'Messages must come from one chat';
  END IF;

  SELECT m.conversation_id INTO v_source
  FROM public.messages m
  WHERE m.id = ANY(p_message_ids)
    AND m.deleted_at IS NULL
  LIMIT 1;

  IF NOT public.is_conversation_participant(v_source, v_uid) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  SELECT c.project_id, c.parent_conversation_id
  INTO v_project, v_main
  FROM public.conversations c
  WHERE c.id = v_source;

  IF v_project IS NULL OR v_main IS NULL THEN
    RAISE EXCEPTION 'Share from a project subgroup into its main chat';
  END IF;

  FOR r IN
    SELECT m.id, m.content, m.media_url, m.media_type, m.sender_id
    FROM public.messages m
    WHERE m.id = ANY(p_message_ids)
      AND m.deleted_at IS NULL
    ORDER BY m.created_at
  LOOP
    SELECT coalesce(p.display_name, 'Member') INTO v_author
    FROM public.profiles p
    WHERE p.user_id = r.sender_id;

    INSERT INTO public.messages (
      conversation_id,
      sender_id,
      content,
      media_url,
      media_type,
      shared_from_message_id,
      shared_from_conversation_id
    ) VALUES (
      v_main,
      v_uid,
      trim(both E'\n' FROM concat(
        'Shared from a subgroup',
        E'\n',
        coalesce(v_author, 'Member'),
        ': ',
        coalesce(r.content, CASE WHEN r.media_type IS NOT NULL THEN '[' || r.media_type || ']' ELSE '' END)
      )),
      r.media_url,
      r.media_type,
      r.id,
      v_source
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.share_messages_to_project_main(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_messages_to_project_main(uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Chat email throttle. One queued email per person per chat per 15 minutes.
-- The window matches CHAT_EMAIL_WINDOW_MS in src/lib/projectCollaborations.ts.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_email_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  pending_count integer NOT NULL DEFAULT 0,
  last_enqueued_at timestamptz,
  UNIQUE (user_id, conversation_id)
);

ALTER TABLE public.chat_email_digests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_email_digests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.chat_email_digests TO service_role;

COMMENT ON TABLE public.chat_email_digests IS
  'Throttle state for project and direct chat email. RLS is on and there are no policies. The browser never reads this table.';

CREATE OR REPLACE FUNCTION public.claim_chat_email_window(
  p_user_id uuid,
  p_conversation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_send boolean := false;
BEGIN
  INSERT INTO public.chat_email_digests AS d (user_id, conversation_id, pending_count, last_enqueued_at)
  VALUES (p_user_id, p_conversation_id, 1, now())
  ON CONFLICT (user_id, conversation_id) DO UPDATE
  SET
    pending_count = CASE
      WHEN d.last_enqueued_at IS NULL OR d.last_enqueued_at <= now() - interval '15 minutes'
      THEN 1
      ELSE d.pending_count + 1
    END,
    last_enqueued_at = CASE
      WHEN d.last_enqueued_at IS NULL OR d.last_enqueued_at <= now() - interval '15 minutes'
      THEN now()
      ELSE d.last_enqueued_at
    END
  RETURNING (pending_count = 1) INTO v_send;

  RETURN coalesce(v_send, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.claim_chat_email_window(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chat_email_window(uuid, uuid) TO service_role;

-- A private project, or one the owner hid, leaves the public events feed.
CREATE OR REPLACE FUNCTION public.sync_project_calendar_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.is_private OR NEW.hide_from_calendar THEN
    UPDATE public.events
    SET is_public = false
    WHERE project_id = NEW.id
      AND is_public IS DISTINCT FROM false;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS sync_project_calendar_visibility ON public.projects;
CREATE TRIGGER sync_project_calendar_visibility
  AFTER INSERT OR UPDATE OF is_private, hide_from_calendar ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_calendar_visibility();

REVOKE ALL ON FUNCTION public.sync_project_calendar_visibility() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_project_calendar_visibility() TO service_role;

UPDATE public.events e
SET is_public = false
FROM public.projects p
WHERE e.project_id = p.id
  AND p.is_private = true
  AND e.is_public IS DISTINCT FROM false;
