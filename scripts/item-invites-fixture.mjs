// A throwaway Postgres (PGlite) with the columns item invites read from
// projects, events, RSVPs, tickets, applications, roles, profiles, blocks,
// notifications and the chat tables (copied from ether-prod's shapes, with
// prod's own chat, match, block and project-chat functions, triggers and
// policies from item-invites-prod-functions.sql), plus the real item_invites
// migration.
// Used by item-invites-db.test.mjs and the phone check's local backend.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export const MIGRATION = "supabase/migrations/20261115140000_item_invites.sql";
export const ROLLBACK = "supabase/rollbacks/20261115140000_item_invites.down.sql";
export const PROD_FUNCTIONS = "scripts/item-invites-prod-functions.sql";

export async function inviteDb() {
  const db = new PGlite();
  await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
 CREATE TABLE public.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, display_name text, city text, city_key text,
   access_status text DEFAULT 'active', is_suspended boolean DEFAULT false, deleted_at timestamptz);
 CREATE TABLE public.user_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), blocker_id uuid, blocked_id uuid, created_at timestamptz DEFAULT now());
 CREATE FUNCTION public.has_blocked(blocker uuid, blocked uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
   SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = blocker AND blocked_id = blocked) $$;
 CREATE FUNCTION public.either_blocked(a uuid, b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
   SELECT a IS NOT NULL AND b IS NOT NULL AND a <> b AND (public.has_blocked(a, b) OR public.has_blocked(b, a)) $$;
 CREATE TABLE public.organization_members(organization_id uuid, user_id uuid);
 CREATE TABLE public.projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_id uuid NOT NULL, title text NOT NULL, status text NOT NULL DEFAULT 'open',
   cover_image_url text, description text, timeline_start date, venue text, is_private boolean NOT NULL DEFAULT false, listing_type text NOT NULL DEFAULT 'project',
   hidden_at timestamptz, removed_at timestamptz);
 CREATE TABLE public.project_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
   role_name text NOT NULL, description text, payout_amount numeric NOT NULL DEFAULT 0, slots_available int NOT NULL DEFAULT 1, slots_filled int NOT NULL DEFAULT 0,
   is_locked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.project_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, role_id uuid REFERENCES public.project_roles(id) ON DELETE CASCADE,
   applicant_id uuid, status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')), message text,
   created_at timestamptz DEFAULT now(), reviewed_at timestamptz, reviewed_by uuid);
 CREATE TABLE public.project_clients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, client_user_id uuid, status text);
 CREATE TABLE public.events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_id uuid NOT NULL, title text NOT NULL, venue text, city text,
   start_date timestamptz, end_date timestamptz, image_url text, is_public boolean DEFAULT true, status text DEFAULT 'published', organization_id uuid,
   password_protected boolean DEFAULT false, hidden_at timestamptz, removed_at timestamptz, ticket_type text DEFAULT 'free');
 CREATE TABLE public.ticket_tiers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, name text, price_cents int DEFAULT 0, is_active boolean DEFAULT true);
 CREATE TABLE public.event_attendees(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL, attendee_user_id uuid, status text NOT NULL DEFAULT 'registered');
 CREATE FUNCTION public.can_manage_event(p_event_id uuid, p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
   SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND (e.creator_id = p_user_id OR (e.organization_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = e.organization_id AND om.user_id = p_user_id))))
 $$;
 CREATE TABLE public.event_rsvps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, user_id uuid, status text DEFAULT 'going');
 CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, type text NOT NULL, title text NOT NULL, body text,
   data jsonb DEFAULT '{}'::jsonb, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
 ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
 CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
 GRANT SELECT, UPDATE, INSERT ON public.notifications TO authenticated;
 CREATE TABLE public.notification_preferences(user_id uuid PRIMARY KEY, project_invites_enabled boolean DEFAULT true);
 GRANT SELECT ON public.projects, public.events TO anon, authenticated;
 CREATE TYPE public.group_visibility AS ENUM ('public','private','discoverable');
 CREATE TYPE public.group_member_role AS ENUM ('owner','moderator','member');
 CREATE TABLE public.collab_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid, recipient_id uuid, status text);
 CREATE TABLE public.creative_matches(first_id uuid, second_id uuid, active boolean DEFAULT true);
 CREATE TABLE public.discovery_preferences(user_id uuid PRIMARY KEY, matches_only boolean DEFAULT false);
 CREATE TABLE public.conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text NOT NULL, name text, avatar_url text, description text,
   created_by uuid NOT NULL, visibility public.group_visibility, project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
   is_client_chat boolean NOT NULL DEFAULT false, parent_conversation_id uuid REFERENCES public.conversations(id), cover_image_url text,
   created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.conversation_participants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
   user_id uuid NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(), last_read_at timestamptz, is_muted boolean DEFAULT false,
   role public.group_member_role DEFAULT 'member', project_role_name text, UNIQUE (conversation_id, user_id));
 CREATE TABLE public.messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
   sender_id uuid NOT NULL, content text, media_url text, media_type text, reply_to_id uuid, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
   updated_at timestamptz DEFAULT now(), deleted_at timestamptz, shared_from_message_id uuid, shared_from_conversation_id uuid,
   shared_post_id uuid, shared_story_id uuid, shared_profile_id uuid);
`);
  await db.exec("SET check_function_bodies = off");
  await db.exec(await readFile(PROD_FUNCTIONS, "utf8"));
  await db.exec("SET check_function_bodies = on");
  await db.exec(`
 CREATE FUNCTION public.is_conversation_admin(c uuid, u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
   SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = c AND user_id = u AND role IN ('owner','moderator')) $$;
 CREATE FUNCTION public.can_self_join_conversation(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
   SELECT EXISTS (SELECT 1 FROM public.conversations WHERE id = c AND type = 'group' AND visibility = 'public' AND project_id IS NULL) $$;
 CREATE TRIGGER on_application_accepted BEFORE UPDATE ON public.project_applications FOR EACH ROW EXECUTE FUNCTION public.handle_application_accepted();
 CREATE TRIGGER enforce_project_conversation BEFORE INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.enforce_project_conversation();
 CREATE TRIGGER creative_participant_privacy BEFORE INSERT OR UPDATE ON public.conversation_participants FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_participant();
 CREATE TRIGGER enforce_project_chat_member BEFORE INSERT ON public.conversation_participants FOR EACH ROW EXECUTE FUNCTION public.enforce_project_chat_member();
 CREATE TRIGGER prevent_blocked_participant BEFORE INSERT ON public.conversation_participants FOR EACH ROW EXECUTE FUNCTION public.prevent_blocked_participant();
 CREATE TRIGGER creative_message_privacy BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_message();
 CREATE TRIGGER on_message_created AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();
 CREATE TRIGGER prevent_blocked_message BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.prevent_blocked_message();
 CREATE TRIGGER scrub_unsent_message BEFORE UPDATE OF deleted_at ON public.messages FOR EACH ROW EXECUTE FUNCTION public.scrub_unsent_message();
 ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;
 CREATE POLICY conv_insert ON public.conversations FOR INSERT WITH CHECK (auth.uid() = created_by);
 CREATE POLICY conv_select ON public.conversations FOR SELECT USING (public.is_conversation_participant(id, auth.uid()) OR created_by = auth.uid() OR public.can_read_conversation(id, auth.uid()));
 CREATE POLICY cp_insert ON public.conversation_participants FOR INSERT WITH CHECK (
   EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_participants.conversation_id AND c.created_by = auth.uid())
   OR (public.is_conversation_admin(conversation_id, auth.uid()) AND role IS DISTINCT FROM 'owner')
   OR (user_id = auth.uid() AND role = 'member' AND public.can_self_join_conversation(conversation_id)));
 CREATE POLICY cp_select ON public.conversation_participants FOR SELECT USING (public.can_read_conversation(conversation_id, auth.uid()));
 CREATE POLICY msg_insert ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND public.is_conversation_participant(conversation_id, auth.uid())
   AND NOT public.sender_blocked_in_conversation(conversation_id, auth.uid()));
 CREATE POLICY msg_update ON public.messages FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
 CREATE POLICY msg_select ON public.messages FOR SELECT USING (public.can_read_conversation(conversation_id, auth.uid())
   AND (deleted_at IS NULL OR (content IS NULL AND media_url IS NULL AND shared_post_id IS NULL AND shared_story_id IS NULL AND shared_profile_id IS NULL AND shared_from_message_id IS NULL))
   AND NOT public.either_blocked(auth.uid(), sender_id));
 CREATE POLICY pa_select ON public.project_applications FOR SELECT USING (applicant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.creator_id = auth.uid()));
 CREATE POLICY pa_insert ON public.project_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = applicant_id);
 CREATE POLICY pa_review ON public.project_applications FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.creator_id = auth.uid()));
 GRANT SELECT, INSERT, UPDATE ON public.conversations, public.conversation_participants, public.messages, public.project_applications TO authenticated;
 GRANT SELECT ON public.project_roles, public.ticket_tiers, public.event_attendees, public.event_rsvps TO authenticated;
 GRANT INSERT ON public.event_rsvps TO authenticated;
`);
  const migration = await readFile(MIGRATION, "utf8");
  await db.exec(migration);
  return { db, migration };
}

export async function as(db, role, id = "") {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET ROLE ${role}`);
}

export async function addUser(db, id, name, cityKey = "charlotte|nc", extra = {}) {
  await db.query("INSERT INTO auth.users VALUES($1) ON CONFLICT DO NOTHING", [id]);
  await db.query(
    "INSERT INTO public.profiles(user_id,display_name,city,city_key,access_status,is_suspended) VALUES($1,$2,$3,$4,$5,$6)",
    [id, name, cityKey ? cityKey.split("|")[0] : null, cityKey, extra.access_status ?? "active", extra.is_suspended ?? false],
  );
}
