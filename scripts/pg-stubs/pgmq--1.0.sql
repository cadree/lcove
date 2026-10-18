-- Enough of pgmq for supabase/migrations/20260420190900_email_infra.sql.

CREATE FUNCTION "create"(queue_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN;
END;
$$;

CREATE FUNCTION send(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE sql
AS $$
  SELECT 1::bigint;
$$;

CREATE FUNCTION "read"(queue_name text, vt integer, batch_size integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE sql
AS $$
  SELECT NULL::bigint, NULL::integer, NULL::jsonb WHERE false;
$$;

CREATE FUNCTION "delete"(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT true;
$$;
