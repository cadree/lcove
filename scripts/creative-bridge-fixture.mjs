// A throwaway Postgres (PGlite) with the columns the creative-bridge features
// read from profiles, projects, roles, applications, posts, notifications,
// blocks, discovery preferences and reports (copied from ether-prod's shapes),
// prod's own rule functions from creative-bridge-prod-functions.sql (blocks,
// discovery, project visibility, report insert, moderation, accepted-role
// slots), prod's RLS policies on projects and posts, and then the real
// creative-bridge migrations in order.
// Used by creative-bridge-db.test.mjs and the phone check's local backend.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export const MIGRATIONS = [
  "supabase/migrations/20261115160000_work_credits.sql",
  "supabase/migrations/20261115161000_open_to.sql",
  "supabase/migrations/20261115162000_project_vouches.sql",
];
/** Whether a creative-bridge migration (by name, e.g. "open_to") is part of this build. */
export const has = (name) => MIGRATIONS.some((m) => m.includes(`_${name}.sql`));
export const ROLLBACKS = MIGRATIONS.map((m) => m.replace("migrations/", "rollbacks/").replace(/\.sql$/, ".down.sql"));
export const PROD_FUNCTIONS = "scripts/creative-bridge-prod-functions.sql";

/** The tables and prod rules, without any creative-bridge migration. */
export async function baseDb() {
  const db = new PGlite();
  await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE authenticator;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
 CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
 CREATE TABLE public.user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role public.app_role NOT NULL);
 CREATE TABLE public.profiles(id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
   display_name text, city text, city_display text, city_key text, bio text, avatar_url text, onboarding_completed boolean DEFAULT true,
   access_status text DEFAULT 'active', is_suspended boolean DEFAULT false, deleted_at timestamptz, created_at timestamptz DEFAULT now(),
   show_only_to_passed_exam boolean DEFAULT false, passed_exam boolean DEFAULT false);
 CREATE VIEW public.profiles_public AS SELECT id, user_id, display_name, city, city_display, city_key, bio, avatar_url, onboarding_completed,
   created_at, access_status, is_suspended FROM public.profiles WHERE deleted_at IS NULL AND access_status IS DISTINCT FROM 'banned';
 GRANT SELECT ON public.profiles_public TO authenticated;
 CREATE TABLE public.user_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), blocker_id uuid, blocked_id uuid, created_at timestamptz DEFAULT now());
 CREATE TABLE public.discovery_preferences(user_id uuid PRIMARY KEY, discoverable boolean NOT NULL DEFAULT true, matches_only boolean NOT NULL DEFAULT false);
 CREATE TABLE public.projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_id uuid NOT NULL, title text NOT NULL,
   description text, status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','in_progress','completed','cancelled')),
   cover_image_url text, timeline_start date, timeline_end date, venue text, is_private boolean NOT NULL DEFAULT false,
   listing_type text NOT NULL DEFAULT 'project', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
   hidden_at timestamptz, removed_at timestamptz);
 CREATE TABLE public.project_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
   role_name text NOT NULL, description text, payout_amount numeric NOT NULL DEFAULT 0, slots_available int NOT NULL DEFAULT 1, slots_filled int NOT NULL DEFAULT 0,
   is_locked boolean NOT NULL DEFAULT false, credit_amount numeric NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.project_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
   role_id uuid REFERENCES public.project_roles(id) ON DELETE CASCADE, applicant_id uuid,
   status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')), message text,
   created_at timestamptz DEFAULT now(), reviewed_at timestamptz, reviewed_by uuid);
 CREATE TABLE public.project_clients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, client_user_id uuid, status text);
 CREATE TABLE public.posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, content text, media_url text, media_type text,
   thumbnail_url text, created_at timestamptz DEFAULT now(), collaborators uuid[], hidden_at timestamptz, removed_at timestamptz);
 CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, type text NOT NULL, title text NOT NULL, body text,
   data jsonb DEFAULT '{}'::jsonb, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.content_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
   target_type text NOT NULL, target_id uuid NOT NULL, reason text NOT NULL, details text, status text NOT NULL DEFAULT 'open',
   created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), reviewed_by uuid, reviewed_at timestamptz,
   CONSTRAINT content_reports_target_type_check CHECK ((target_type = ANY (ARRAY['post'::text, 'profile'::text, 'message'::text, 'comment'::text, 'project'::text, 'stream_message'::text, 'stream'::text, 'event'::text]))));
`);
  await db.exec("SET check_function_bodies = off");
  await db.exec(await readFile(PROD_FUNCTIONS, "utf8"));
  await db.exec("SET check_function_bodies = on");
  await db.exec(`
 CREATE TRIGGER on_application_accepted BEFORE UPDATE ON public.project_applications FOR EACH ROW EXECUTE FUNCTION public.handle_application_accepted();
 CREATE TRIGGER protect_moderation_columns BEFORE DELETE OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.protect_moderation_columns();
 CREATE TRIGGER protect_moderation_columns BEFORE DELETE OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.protect_moderation_columns();
 CREATE TRIGGER enforce_report_insert BEFORE INSERT ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.enforce_report_insert();
 ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
 -- prod's policies (pg_policies, 2026-11-15)
 CREATE POLICY "Projects are visible to the community or their members" ON public.projects FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR ((removed_at IS NULL) AND ((hidden_at IS NULL) OR (creator_id = auth.uid())) AND ((creator_id = auth.uid()) OR can_view_project(id, auth.uid()))));
 CREATE POLICY "Creators can update their projects" ON public.projects FOR UPDATE USING (auth.uid() = creator_id);
 CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = creator_id);
 CREATE POLICY "Members can view posts" ON public.posts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR ((removed_at IS NULL) AND ((hidden_at IS NULL) OR (user_id = auth.uid())) AND (NOT either_blocked(auth.uid(), user_id))));
 CREATE POLICY "Users can create own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
 CREATE POLICY "Roles follow project visibility" ON public.project_roles FOR SELECT TO authenticated USING (can_view_project(project_id, auth.uid()));
 CREATE POLICY "Project creators can manage roles" ON public.project_roles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_roles.project_id AND p.creator_id = auth.uid()));
 CREATE POLICY "Project creators can update roles" ON public.project_roles FOR UPDATE USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_roles.project_id AND p.creator_id = auth.uid()));
 CREATE POLICY "Applicants can view own applications" ON public.project_applications FOR SELECT USING ((applicant_id = auth.uid()) OR (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_applications.project_id AND p.creator_id = auth.uid())));
 CREATE POLICY "Users can apply to visible projects" ON public.project_applications FOR INSERT TO authenticated WITH CHECK ((auth.uid() = applicant_id) AND can_view_project(project_id, auth.uid()));
 CREATE POLICY "Creators can review applications" ON public.project_applications FOR UPDATE USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_applications.project_id AND p.creator_id = auth.uid()));
 CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
 CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
 CREATE POLICY "Reporters insert own reports" ON public.content_reports FOR INSERT TO authenticated WITH CHECK ((reporter_id = auth.uid()) AND (status = 'open'::text));
 CREATE POLICY "Reporters read own reports" ON public.content_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());
 CREATE POLICY "Admins read reports" ON public.content_reports FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
 GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects, public.posts, public.project_roles, public.project_applications TO authenticated;
 GRANT SELECT, UPDATE ON public.notifications TO authenticated;
 ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
 CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
 CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
 GRANT SELECT, UPDATE ON public.profiles TO authenticated;
 GRANT SELECT ON public.user_roles TO authenticated;
 GRANT SELECT, INSERT ON public.content_reports TO authenticated;
`);
  return db;
}

/** The base plus the creative-bridge migrations up to and including `upTo` (all by default). */
export async function bridgeDb(upTo = MIGRATIONS.length) {
  const db = await baseDb();
  const migrations = [];
  for (const file of MIGRATIONS.slice(0, upTo)) {
    const sql = await readFile(file, "utf8");
    await db.exec(sql);
    migrations.push(sql);
  }
  return { db, migrations };
}

export async function as(db, role, id = "") {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET ROLE ${role}`);
}

export async function addUser(db, id, name, cityKey = "charlotte|nc", extra = {}) {
  await db.query("INSERT INTO auth.users VALUES($1) ON CONFLICT DO NOTHING", [id]);
  await db.query(
    "INSERT INTO public.profiles(user_id,display_name,city,city_display,city_key,access_status,is_suspended,onboarding_completed,avatar_url,bio) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [id, name, cityKey ? cityKey.split("|")[0] : null, extra.city_display ?? null, cityKey, extra.access_status ?? "active", extra.is_suspended ?? false,
      extra.onboarding_completed ?? true, extra.avatar_url ?? null, extra.bio ?? null],
  );
}
