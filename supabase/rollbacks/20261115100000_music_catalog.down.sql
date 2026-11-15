-- Rollback for 20261115100000_music_catalog.sql.
-- Drops only the catalog layout (section names, order, covers, placements).
-- Releases on music_profiles and locked tracks in exclusive_tracks are untouched.

DROP TABLE IF EXISTS public.music_section_items;
DROP TABLE IF EXISTS public.music_sections;
DROP FUNCTION IF EXISTS public.guard_music_section_item();
