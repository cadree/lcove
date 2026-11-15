-- Music catalog: artists group their music into sections they name and order
-- (Albums, Mixtapes, DJ Mixes, Singles, anything), and place each item in one.
--
-- An item is either a linked release saved on music_profiles (key "release:<host/path>")
-- or a locked track in exclusive_tracks (key "track:<uuid>"). Payment, prices and who
-- can play a locked file are unchanged: that stays with exclusive_tracks, the private
-- bucket and can_read_private_music. These tables only hold names, order and covers.
--
-- Apply by hand (migrations are not deployed by CI). Rollback:
-- supabase/rollbacks/20261115100000_music_catalog.down.sql

CREATE TABLE IF NOT EXISTS public.music_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
  cover_url text CHECK (cover_url IS NULL OR (cover_url ~ '^https://' AND char_length(cover_url) <= 2048)),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS music_sections_user_position_idx
  ON public.music_sections (user_id, position);

CREATE TABLE IF NOT EXISTS public.music_section_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.music_sections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL CHECK (char_length(item_key) <= 2100),
  exclusive_track_id uuid REFERENCES public.exclusive_tracks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One place per item: moving an item to another section updates this row.
  CONSTRAINT music_section_items_one_section UNIQUE (user_id, item_key),
  -- A track key always names its own track row; a release key never has one.
  CONSTRAINT music_section_items_key_shape CHECK (
    (item_key LIKE 'release:_%' AND exclusive_track_id IS NULL)
    OR (exclusive_track_id IS NOT NULL AND item_key = 'track:' || exclusive_track_id::text)
  )
);

CREATE INDEX IF NOT EXISTS music_section_items_section_idx
  ON public.music_section_items (section_id, position);

DROP TRIGGER IF EXISTS music_sections_updated_at ON public.music_sections;
CREATE TRIGGER music_sections_updated_at
  BEFORE UPDATE ON public.music_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- An item row must sit in a section of the same owner and point only at the
-- owner's own track. Checked in a trigger too (not only RLS) so service-role
-- writes and future policies cannot mix two artists' catalogs.
CREATE OR REPLACE FUNCTION public.guard_music_section_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.music_sections s WHERE s.id = NEW.section_id AND s.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Section belongs to another artist' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.exclusive_track_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.exclusive_tracks t
    WHERE t.id = NEW.exclusive_track_id AND t.artist_user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Track belongs to another artist' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_music_section_item() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_music_section_item ON public.music_section_items;
CREATE TRIGGER guard_music_section_item
  BEFORE INSERT OR UPDATE ON public.music_section_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_music_section_item();

ALTER TABLE public.music_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_section_items ENABLE ROW LEVEL SECURITY;

-- Section names, order and covers are public, like the rest of a profile.
DROP POLICY IF EXISTS "Anyone can view music sections" ON public.music_sections;
CREATE POLICY "Anyone can view music sections" ON public.music_sections
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Owners insert music sections" ON public.music_sections;
CREATE POLICY "Owners insert music sections" ON public.music_sections
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners update music sections" ON public.music_sections;
CREATE POLICY "Owners update music sections" ON public.music_sections
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners delete music sections" ON public.music_sections;
CREATE POLICY "Owners delete music sections" ON public.music_sections
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Visitors see where releases and published tracks sit. A draft track's
-- placement stays with its owner, the same as the draft itself.
DROP POLICY IF EXISTS "Anyone can view placed music" ON public.music_section_items;
CREATE POLICY "Anyone can view placed music" ON public.music_section_items
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR exclusive_track_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.exclusive_tracks t
      WHERE t.id = music_section_items.exclusive_track_id AND t.is_published
    )
  );

DROP POLICY IF EXISTS "Owners insert placed music" ON public.music_section_items;
CREATE POLICY "Owners insert placed music" ON public.music_section_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners update placed music" ON public.music_section_items;
CREATE POLICY "Owners update placed music" ON public.music_section_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners delete placed music" ON public.music_section_items;
CREATE POLICY "Owners delete placed music" ON public.music_section_items
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.music_sections, public.music_section_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_sections, public.music_section_items TO authenticated;
GRANT ALL ON public.music_sections, public.music_section_items TO service_role;
