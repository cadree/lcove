-- Seed two confirmed accounts, two posts, and two likes on a staging
-- Supabase project. Run this only through scripts/apply-staging-project.sh.
-- That script refuses ether-prod (aykopqinnnssxdhxqruo) before it connects.
--
-- Accounts (password is STAGING_SEED_PASSWORD, not stored in this file):
--   ada@staging.ether.test   Ada Staging
--   nico@staging.ether.test  Nico Staging
--
-- The dashboard SQL editor cannot run this file. psql variables are required.

\if :{?staging_project_ref}
\else
\echo 'staging_project_ref is required. Run scripts/apply-staging-project.sh.'
\quit 1
\endif

\if :{?seed_password}
\else
\echo 'seed_password is required. Set STAGING_SEED_PASSWORD.'
\quit 1
\endif

SET client_min_messages TO warning;
DROP TABLE IF EXISTS staging_seed_input;
RESET client_min_messages;
CREATE TEMP TABLE staging_seed_input (
  project_ref text NOT NULL,
  seed_password text NOT NULL
);
INSERT INTO staging_seed_input (project_ref, seed_password)
VALUES (:'staging_project_ref', :'seed_password');

DO $seed$
DECLARE
  staging_ref text;
  seed_password text;
  pgcrypto_schema text;
  instance_id uuid;
  users jsonb := jsonb_build_array(
    jsonb_build_object(
      'id', '11111111-1111-4111-8111-111111111111',
      'email', 'ada@staging.ether.test',
      'display_name', 'Ada Staging',
      'post_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'content', 'Staging feed post from Ada. This database is not ether-prod.'
    ),
    jsonb_build_object(
      'id', '22222222-2222-4222-8222-222222222222',
      'email', 'nico@staging.ether.test',
      'display_name', 'Nico Staging',
      'post_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'content', 'Staging feed post from Nico. Safe to delete.'
    )
  );
  likes jsonb := jsonb_build_array(
    jsonb_build_object(
      'id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'post_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'user_id', '22222222-2222-4222-8222-222222222222'
    ),
    jsonb_build_object(
      'id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      'post_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'user_id', '11111111-1111-4111-8111-111111111111'
    )
  );
  person jsonb;
  like_row jsonb;
  uid uuid;
  user_email text;
  display_name text;
  email_taken boolean;
  names text;
  vals text;
  col record;
  expr text;
  missing text;
  identity_names text;
  identity_vals text;
BEGIN
  SELECT input.project_ref, input.seed_password
  INTO staging_ref, seed_password
  FROM staging_seed_input AS input;

  IF staging_ref = 'aykopqinnnssxdhxqruo' THEN
    RAISE EXCEPTION 'refusing to seed ether-prod (aykopqinnnssxdhxqruo)';
  END IF;
  IF length(seed_password) < 8 THEN
    RAISE EXCEPTION 'seed password must be at least 8 characters';
  END IF;
  IF position(E'\n' IN seed_password) > 0 THEN
    RAISE EXCEPTION 'seed password cannot contain a newline';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'users'
      AND column_name = 'raw_user_meta_data'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb;
  END IF;

  SELECT n.nspname INTO pgcrypto_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto';

  IF pgcrypto_schema IS NULL THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    SELECT n.nspname INTO pgcrypto_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto';
  END IF;

  IF to_regclass('auth.instances') IS NOT NULL THEN
    EXECUTE 'SELECT id FROM auth.instances LIMIT 1' INTO instance_id;
  END IF;
  IF instance_id IS NULL THEN
    instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  FOR person IN SELECT value FROM jsonb_array_elements(users) AS value
  LOOP
    uid := (person ->> 'id')::uuid;
    user_email := person ->> 'email';
    display_name := person ->> 'display_name';

    IF EXISTS (SELECT 1 FROM auth.users WHERE id = uid) THEN
      NULL;
    ELSE
      email_taken := false;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email'
      ) THEN
        EXECUTE
          'SELECT EXISTS (SELECT 1 FROM auth.users WHERE id <> $1 AND lower(email) = lower($2))'
          INTO email_taken
          USING uid, user_email;
      END IF;
      IF email_taken THEN
        RAISE EXCEPTION 'staging seed email % already belongs to a different account', user_email;
      END IF;
      names := '';
      vals := '';
      missing := '';
      FOR col IN
        SELECT column_name, is_nullable, column_default, is_generated, is_identity
        FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'users'
        ORDER BY ordinal_position
      LOOP
        IF COALESCE(col.is_generated, 'NEVER') <> 'NEVER' OR col.is_identity = 'YES' THEN
          CONTINUE;
        END IF;
        expr := NULL;
        IF col.column_name = 'id' THEN
          expr := quote_literal(uid);
        ELSIF col.column_name = 'instance_id' THEN
          expr := quote_literal(instance_id);
        ELSIF col.column_name = 'aud' THEN
          expr := quote_literal('authenticated');
        ELSIF col.column_name = 'role' THEN
          expr := quote_literal('authenticated');
        ELSIF col.column_name = 'email' THEN
          expr := quote_literal(user_email);
        ELSIF col.column_name = 'encrypted_password' THEN
          IF pgcrypto_schema IS NULL THEN
            RAISE EXCEPTION 'pgcrypto is required to seed a password';
          END IF;
          expr := format(
            '%I.crypt(%s, %I.gen_salt(%s))',
            pgcrypto_schema,
            quote_literal(seed_password),
            pgcrypto_schema,
            quote_literal('bf')
          );
        ELSIF col.column_name IN ('email_confirmed_at', 'created_at', 'updated_at', 'last_sign_in_at', 'confirmation_sent_at') THEN
          expr := 'now()';
        ELSIF col.column_name = 'raw_app_meta_data' THEN
          expr := quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb';
        ELSIF col.column_name = 'raw_user_meta_data' THEN
          expr := quote_literal(jsonb_build_object('display_name', display_name)::text) || '::jsonb';
        ELSIF col.column_name IN (
          'confirmation_token',
          'recovery_token',
          'email_change',
          'email_change_token_new',
          'email_change_token_current',
          'email_change_token',
          'reauthentication_token',
          'phone_change',
          'phone_change_token'
        ) THEN
          expr := quote_literal('');
        ELSIF col.column_name IN ('is_sso_user', 'is_anonymous', 'is_super_admin') THEN
          expr := 'false';
        END IF;

        IF expr IS NOT NULL THEN
          names := names || quote_ident(col.column_name) || ', ';
          vals := vals || expr || ', ';
        ELSIF col.is_nullable = 'NO' AND col.column_default IS NULL THEN
          missing := missing || col.column_name || ', ';
        END IF;
      END LOOP;

      IF missing <> '' THEN
        RAISE EXCEPTION 'auth.users is missing values for NOT NULL columns: %', missing;
      END IF;
      IF names = '' THEN
        RAISE EXCEPTION 'auth.users has no columns this seed knows how to fill';
      END IF;

      names := left(names, length(names) - 2);
      vals := left(vals, length(vals) - 2);
      EXECUTE format(
        'INSERT INTO auth.users (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING',
        names,
        vals
      );
    END IF;

    IF to_regclass('auth.identities') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM auth.identities WHERE user_id = uid
    ) THEN
      identity_names := '';
      identity_vals := '';
      missing := '';
      FOR col IN
        SELECT column_name, is_nullable, column_default, is_generated, is_identity
        FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'identities'
        ORDER BY ordinal_position
      LOOP
        IF COALESCE(col.is_generated, 'NEVER') <> 'NEVER' OR col.is_identity = 'YES' THEN
          CONTINUE;
        END IF;
        expr := NULL;
        IF col.column_name = 'id' THEN
          expr := quote_literal(uid);
        ELSIF col.column_name = 'user_id' THEN
          expr := quote_literal(uid);
        ELSIF col.column_name = 'provider_id' THEN
          expr := quote_literal(uid::text);
        ELSIF col.column_name = 'provider' THEN
          expr := quote_literal('email');
        ELSIF col.column_name = 'identity_data' THEN
          expr := quote_literal(jsonb_build_object(
            'sub', uid::text,
            'email', user_email,
            'email_verified', true
          )::text) || '::jsonb';
        ELSIF col.column_name = 'email' THEN
          expr := quote_literal(user_email);
        ELSIF col.column_name IN ('last_sign_in_at', 'created_at', 'updated_at') THEN
          expr := 'now()';
        END IF;

        IF expr IS NOT NULL THEN
          identity_names := identity_names || quote_ident(col.column_name) || ', ';
          identity_vals := identity_vals || expr || ', ';
        ELSIF col.is_nullable = 'NO' AND col.column_default IS NULL THEN
          missing := missing || col.column_name || ', ';
        END IF;
      END LOOP;

      IF missing <> '' THEN
        RAISE EXCEPTION 'auth.identities is missing values for NOT NULL columns: %', missing;
      END IF;
      IF identity_names <> '' THEN
        identity_names := left(identity_names, length(identity_names) - 2);
        identity_vals := left(identity_vals, length(identity_vals) - 2);
        EXECUTE format(
          'INSERT INTO auth.identities (%s) VALUES (%s) ON CONFLICT DO NOTHING',
          identity_names,
          identity_vals
        );
      END IF;
    END IF;
    END IF;

    INSERT INTO public.profiles (
      user_id,
      display_name,
      bio,
      city,
      onboarding_completed,
      onboarding_score,
      access_status
    ) VALUES (
      uid,
      display_name,
      'Staging account for preview builds. Not a member of ether-prod.',
      'Charlotte',
      true,
      30,
      'active'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      bio = EXCLUDED.bio,
      city = EXCLUDED.city,
      onboarding_completed = EXCLUDED.onboarding_completed,
      onboarding_score = EXCLUDED.onboarding_score,
      access_status = EXCLUDED.access_status;

    INSERT INTO public.posts (id, user_id, content, media_type, post_type)
    VALUES (
      (person ->> 'post_id')::uuid,
      uid,
      person ->> 'content',
      'text',
      'regular'
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      content = EXCLUDED.content,
      media_type = EXCLUDED.media_type,
      post_type = EXCLUDED.post_type;
  END LOOP;

  FOR like_row IN SELECT value FROM jsonb_array_elements(likes) AS value
  LOOP
    INSERT INTO public.post_likes (id, post_id, user_id)
    VALUES (
      (like_row ->> 'id')::uuid,
      (like_row ->> 'post_id')::uuid,
      (like_row ->> 'user_id')::uuid
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END
$seed$;
