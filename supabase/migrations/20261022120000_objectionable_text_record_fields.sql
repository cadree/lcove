-- reject_objectionable_text is one trigger function for several tables.
-- In PL/pgSQL, NEW.field is resolved for every arm of a CASE, so a profile
-- insert errors with: record "new" has no field "content". Read the row as
-- jsonb so each table only sees its own columns. The allowed text does not change.

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
    ELSE NULL
  END;

  IF public.objectionable_text(sample) THEN
    RAISE EXCEPTION 'That text isn''t allowed.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
