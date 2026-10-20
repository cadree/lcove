-- Additive columns for YouTube and Vimeo posts.
-- Apply this file by hand on the live database. Do not run it from CI,
-- and do not apply it as part of a deploy.
-- Existing rows stay valid: every new column is nullable, and a post with
-- no embed leaves all of them null.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS embed_provider text,
  ADD COLUMN IF NOT EXISTS embed_video_id text,
  ADD COLUMN IF NOT EXISTS embed_hash text,
  ADD COLUMN IF NOT EXISTS embed_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS embed_title text;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_embed_shape_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_embed_shape_check
  CHECK (
    (
      embed_provider IS NULL
      AND embed_video_id IS NULL
      AND embed_hash IS NULL
    )
    OR (
      embed_provider = 'youtube'
      AND embed_video_id ~ '^[A-Za-z0-9_-]{11}$'
      AND embed_hash IS NULL
    )
    OR (
      embed_provider = 'vimeo'
      AND embed_video_id ~ '^[0-9]{6,12}$'
      AND (embed_hash IS NULL OR embed_hash ~ '^[A-Za-z0-9]{4,64}$')
    )
  );

COMMENT ON COLUMN public.posts.embed_provider IS 'youtube or vimeo. Null for uploaded media and text posts.';
COMMENT ON COLUMN public.posts.embed_video_id IS 'Provider video id. The player URL is built from this, never from a stored page URL.';
COMMENT ON COLUMN public.posts.embed_hash IS 'Optional Vimeo unlisted hash. Null for YouTube and public Vimeo.';
COMMENT ON COLUMN public.posts.embed_thumbnail_url IS 'https thumbnail from i.ytimg.com, img.youtube.com, or i.vimeocdn.com.';
COMMENT ON COLUMN public.posts.embed_title IS 'Title from the free oEmbed response, when one was available.';
