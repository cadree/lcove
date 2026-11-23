-- Music profile view: the owner's look (Ether or Neon), featured item, the order of
-- music not in an album, and cover overrides for linked releases. Albums, their
-- covers and the order inside an album stay in music_sections / music_section_items;
-- a locked track's own cover stays on exclusive_tracks.cover_image_url.
--
-- Public read (visitors see the owner's look and order), owner-only writes.
-- Apply by hand. Rollback: supabase/rollbacks/20261123120000_music_page_prefs.down.sql

CREATE TABLE IF NOT EXISTS public.music_page_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  look text NOT NULL DEFAULT 'ether' CHECK (look IN ('ether', 'neon')),
  featured_key text CHECK (featured_key IS NULL OR char_length(featured_key) <= 2100),
  loose_order text[] NOT NULL DEFAULT '{}' CHECK (cardinality(loose_order) <= 500),
  cover_overrides jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(cover_overrides) = 'object' AND octet_length(cover_overrides::text) <= 65536
  ),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS music_page_prefs_updated_at ON public.music_page_prefs;
CREATE TRIGGER music_page_prefs_updated_at
  BEFORE UPDATE ON public.music_page_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.music_page_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view music page prefs" ON public.music_page_prefs;
CREATE POLICY "Anyone can view music page prefs" ON public.music_page_prefs
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Owners insert music page prefs" ON public.music_page_prefs;
CREATE POLICY "Owners insert music page prefs" ON public.music_page_prefs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners update music page prefs" ON public.music_page_prefs;
CREATE POLICY "Owners update music page prefs" ON public.music_page_prefs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners delete music page prefs" ON public.music_page_prefs;
CREATE POLICY "Owners delete music page prefs" ON public.music_page_prefs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.music_page_prefs FROM anon, authenticated;
GRANT SELECT ON public.music_page_prefs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_page_prefs TO authenticated;
GRANT ALL ON public.music_page_prefs TO service_role;
