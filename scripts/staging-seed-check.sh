#!/usr/bin/env bash
# Apply every migration to a throwaway local Postgres database, then apply
# supabase/seed/staging.sql twice and check the rows. Refuses to run the
# seed when the project ref is ether-prod.
#
# This script never reads STAGING_DB_URL and never opens a remote connection.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STUB_SRC="$ROOT/scripts/pg-stubs"
EXT_DIR=""
PROD_REF="aykopqinnnssxdhxqruo"
STAGING_REF="bbbbbbbbbbbbbbbbbbbb"
SEED_PASSWORD="staging-test-password"

install_stubs() {
  local share
  share="$(pg_config --sharedir 2>/dev/null || true)"
  if [ -z "$share" ]; then
    echo "pg_config is not installed" >&2
    exit 1
  fi
  EXT_DIR="$share/extension"
  if [ ! -d "$EXT_DIR" ]; then
    echo "Postgres extension directory not found: $EXT_DIR" >&2
    exit 1
  fi
  sudo mkdir -p "$EXT_DIR"
  sudo cp "$STUB_SRC"/pg_cron.control "$STUB_SRC"/pg_cron--1.0.sql \
    "$STUB_SRC"/pg_net.control "$STUB_SRC"/pg_net--1.0.sql \
    "$STUB_SRC"/supabase_vault.control "$STUB_SRC"/supabase_vault--1.0.sql \
    "$STUB_SRC"/pgmq.control "$STUB_SRC"/pgmq--1.0.sql \
    "$EXT_DIR"/
  echo "installed scratch extension stubs into $EXT_DIR"
}

if [ "$(id -un)" != "postgres" ]; then
  if ! command -v psql >/dev/null 2>&1 || ! command -v pg_config >/dev/null 2>&1; then
    echo "psql and pg_config are required" >&2
    exit 1
  fi
  install_stubs
  exec sudo -u postgres bash "$0" "$@"
fi

if ! pg_isready -q; then
  echo "local Postgres is not accepting connections" >&2
  exit 1
fi

DB_NAME="ether_staging_seed_$$"

cleanup() {
  dropdb --if-exists "$DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "creating scratch database $DB_NAME"
createdb "$DB_NAME"

echo "applying bootstrap"
psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -f "$ROOT/scripts/integration-rls-bootstrap.sql"

echo "applying migrations"
count=0
while IFS= read -r file; do
  count=$((count + 1))
  base="$(basename "$file")"
  if ! psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -c "SET client_min_messages TO warning" -f "$file"; then
    echo "FAILED applying $base" >&2
    exit 1
  fi
done < <(find "$ROOT/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | sort)
echo "applied $count migrations"

echo "seed refuses ether-prod"
set +e
prod_out="$(psql -v ON_ERROR_STOP=1 -d "$DB_NAME" \
  -v staging_project_ref="$PROD_REF" \
  -v seed_password="$SEED_PASSWORD" \
  -f "$ROOT/supabase/seed/staging.sql" 2>&1)"
prod_status=$?
set -e
if [ "$prod_status" -eq 0 ]; then
  echo "seed applied against the ether-prod ref" >&2
  exit 1
fi
printf '%s\n' "$prod_out" | grep -q "refusing to seed ether-prod" || {
  echo "expected the ether-prod refusal, got:" >&2
  printf '%s\n' "$prod_out" >&2
  exit 1
}
printf '%s\n' "$prod_out" | grep -q "$SEED_PASSWORD" && {
  echo "ether-prod refusal printed the seed password" >&2
  exit 1
}

echo "applying staging seed"
psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" \
  -v staging_project_ref="$STAGING_REF" \
  -v seed_password="$SEED_PASSWORD" \
  -f "$ROOT/supabase/seed/staging.sql"

echo "applying staging seed again"
psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" \
  -v staging_project_ref="$STAGING_REF" \
  -v seed_password="$SEED_PASSWORD" \
  -f "$ROOT/supabase/seed/staging.sql"

psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" <<'SQL'
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.profiles
  WHERE user_id IN (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  )
  AND display_name IN ('Ada Staging', 'Nico Staging')
  AND onboarding_completed = true;
  IF n <> 2 THEN
    RAISE EXCEPTION 'expected 2 staging profiles, found %', n;
  END IF;

  SELECT count(*) INTO n FROM public.posts
  WHERE id IN (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
  );
  IF n <> 2 THEN
    RAISE EXCEPTION 'expected 2 staging posts, found %', n;
  END IF;

  SELECT count(*) INTO n FROM public.post_likes
  WHERE id IN (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
  );
  IF n <> 2 THEN
    RAISE EXCEPTION 'expected 2 staging likes, found %', n;
  END IF;
END $$;
SQL

echo "staging seed checks passed"
