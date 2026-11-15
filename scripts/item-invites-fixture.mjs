// A throwaway Postgres (PGlite) with the columns item invites read from
// projects, events, RSVPs, applications, profiles, blocks and notifications
// (copied from ether-prod's shapes), plus the real item_invites migration.
// Used by item-invites-db.test.mjs and the phone check's local backend.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export const MIGRATION = "supabase/migrations/20261115140000_item_invites.sql";
export const ROLLBACK = "supabase/rollbacks/20261115140000_item_invites.down.sql";

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
   cover_image_url text, timeline_start date, venue text, is_private boolean NOT NULL DEFAULT false, listing_type text NOT NULL DEFAULT 'project',
   hidden_at timestamptz, removed_at timestamptz);
 CREATE TABLE public.project_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, role_id uuid, applicant_id uuid, status text DEFAULT 'pending');
 CREATE TABLE public.events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_id uuid NOT NULL, title text NOT NULL, venue text, city text,
   start_date timestamptz, end_date timestamptz, image_url text, is_public boolean DEFAULT true, status text DEFAULT 'published', organization_id uuid,
   password_protected boolean DEFAULT false, hidden_at timestamptz, removed_at timestamptz);
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
