-- Owners could not delete an ended stream when another row pointed at it
-- through parent_event_id (that foreign key had no delete action) or when
-- child rows existed that row-level security would not let the host delete
-- one by one. This removes the owner's stream in one step. Child chat,
-- reactions, tips, gifts, and viewers already cascade.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'live_streams'
    AND con.contype = 'f'
    AND pg_get_constraintdef(con.oid) ILIKE '%parent_event_id%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.live_streams DROP CONSTRAINT %I', constraint_name);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'live_streams'
      AND column_name = 'parent_event_id'
  ) THEN
    ALTER TABLE public.live_streams
      ADD CONSTRAINT live_streams_parent_event_id_fkey
      FOREIGN KEY (parent_event_id)
      REFERENCES public.live_streams(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delete_own_live_stream(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.live_streams
    WHERE id = p_stream_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only delete your own streams'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_streams
  SET parent_event_id = NULL
  WHERE parent_event_id = p_stream_id;

  DELETE FROM public.live_streams
  WHERE id = p_stream_id AND host_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_live_stream(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_live_stream(uuid) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_tips;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'skipped adding stream_tips to supabase_realtime: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_gifts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'skipped adding stream_gifts to supabase_realtime: %', SQLERRM;
END $$;
