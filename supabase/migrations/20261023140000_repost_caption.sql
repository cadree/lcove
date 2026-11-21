-- Optional caption on a profile repost. Apply on staging and production
-- before a captioned repost can be stored. An empty caption is omitted by
-- the client, so a repost without a caption still inserts if this column
-- is not there yet.

ALTER TABLE public.reposts
  ADD COLUMN IF NOT EXISTS caption text;

ALTER TABLE public.reposts
  DROP CONSTRAINT IF EXISTS reposts_caption_length;

ALTER TABLE public.reposts
  ADD CONSTRAINT reposts_caption_length
  CHECK (caption IS NULL OR char_length(caption) <= 500);
