-- Runs after 20261020140000_sharing_reposts_and_post_views.sql on the scratch database.
-- Prints one row per check. detail starting with FAIL means the rule did not hold.

CREATE TABLE IF NOT EXISTS public.proof_results (
  step text PRIMARY KEY,
  detail text NOT NULL
);

TRUNCATE public.proof_results;

INSERT INTO public.posts (id, user_id, media_type, media_url)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'photo', 'https://example.com/a.jpg'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'video', 'https://example.com/b.mp4');

INSERT INTO public.post_views (post_id, viewer_id, viewed_on)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  (timezone('utc', now()))::date
);

CREATE OR REPLACE FUNCTION public.proof_as(p_role name, p_uid uuid, p_sql text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_detail text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    EXECUTE p_sql INTO v_detail;
  EXCEPTION WHEN OTHERS THEN
    v_detail := SQLSTATE || ' ' || SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  RETURN v_detail;
END;
$$;

INSERT INTO public.proof_results (step, detail)
VALUES (
  'non_owner_table_select',
  public.proof_as(
    'authenticated',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'SELECT count(*)::text FROM public.post_views'
  )
);

INSERT INTO public.proof_results (step, detail)
VALUES (
  'non_owner_rpc_on_other_post',
  public.proof_as(
    'authenticated',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    $q$SELECT COALESCE(sum(view_count), 0)::text FROM public.get_own_post_view_counts(ARRAY['11111111-1111-4111-8111-111111111111']::uuid[])$q$
  )
);

INSERT INTO public.proof_results (step, detail)
VALUES (
  'owner_rpc_count',
  public.proof_as(
    'authenticated',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    $q$SELECT COALESCE(sum(view_count), 0)::text FROM public.get_own_post_view_counts(ARRAY['11111111-1111-4111-8111-111111111111']::uuid[])$q$
  )
);

SELECT public.proof_as(
  'authenticated',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'SELECT public.record_post_view(''11111111-1111-4111-8111-111111111111'')'
);

INSERT INTO public.proof_results (step, detail)
VALUES (
  'owner_view_not_counted',
  public.proof_as(
    'authenticated',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    $q$SELECT COALESCE(sum(view_count), 0)::text FROM public.get_own_post_view_counts(NULL)$q$
  )
);

SELECT public.proof_as(
  'authenticated',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'SELECT public.record_post_view(''11111111-1111-4111-8111-111111111111'')'
);

SELECT public.proof_as(
  'authenticated',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'SELECT public.record_post_view(''11111111-1111-4111-8111-111111111111'')'
);

INSERT INTO public.proof_results (step, detail)
VALUES (
  'one_view_per_viewer_per_day',
  public.proof_as(
    'authenticated',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    $q$SELECT COALESCE(sum(view_count), 0)::text FROM public.get_own_post_view_counts(NULL)$q$
  )
);

INSERT INTO public.proof_results (step, detail)
VALUES (
  'viewer_dashboard_hides_others',
  public.proof_as(
    'authenticated',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'SELECT views_30d::text FROM public.get_own_view_dashboard()'
  )
);

INSERT INTO public.proof_results (step, detail)
VALUES (
  'owner_dashboard_30d',
  public.proof_as(
    'authenticated',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'SELECT views_30d::text FROM public.get_own_view_dashboard()'
  )
);

SELECT step, detail FROM public.proof_results ORDER BY step;
