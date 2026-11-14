-- Let the feed and story row hear new posts and stories.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'posts'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped adding posts to supabase_realtime: %', SQLERRM;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'stories'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped adding stories to supabase_realtime: %', SQLERRM;
    END;
  END IF;
END $$;
