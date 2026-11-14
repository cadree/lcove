-- Repost captions use the same objectionable-text check as posts.
-- Body copied from 20261022120000_objectionable_text_record_fields.sql.
-- SECURITY DEFINER and search_path stay as 20261023040000 left them.
-- Dropping those was a production outage. Only the reposts arm is new.

CREATE OR REPLACE FUNCTION public.reject_objectionable_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sample text;
  row_json jsonb := to_jsonb(NEW);
BEGIN
  sample := CASE TG_TABLE_NAME
    WHEN 'posts' THEN row_json ->> 'content'
    WHEN 'post_comments' THEN row_json ->> 'content'
    WHEN 'messages' THEN row_json ->> 'content'
    WHEN 'stream_chat' THEN row_json ->> 'body'
    WHEN 'profiles' THEN concat_ws(' ', row_json ->> 'display_name', row_json ->> 'bio')
    WHEN 'live_streams' THEN concat_ws(' ', row_json ->> 'title', row_json ->> 'description')
    WHEN 'reposts' THEN row_json ->> 'caption'
    ELSE NULL
  END;

  IF public.objectionable_text(sample) THEN
    RAISE EXCEPTION 'That text isn''t allowed.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.reject_objectionable_text()
  SECURITY DEFINER
  SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS reject_objectionable_reposts ON public.reposts;
CREATE TRIGGER reject_objectionable_reposts
  BEFORE INSERT OR UPDATE OF caption ON public.reposts
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_objectionable_text();
