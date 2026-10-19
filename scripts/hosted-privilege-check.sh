#!/usr/bin/env bash
# Apply supabase/bundle/ether-schema.sql twice as a non-superuser that is
# not a member of a stub supabase_admin role. Hosted Management API runs as
# postgres, which fails the same way on ALTER DEFAULT PRIVILEGES FOR ROLE
# supabase_admin. This script never reads DATABASE_URL and never opens a
# remote connection.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STUB_SRC="$ROOT/scripts/pg-stubs"
BUNDLE="$ROOT/supabase/bundle/ether-schema.sql"

install_stubs() {
  local share
  share="$(pg_config --sharedir 2>/dev/null || true)"
  if [ -z "$share" ]; then
    echo "pg_config is not installed" >&2
    exit 1
  fi
  local ext_dir="$share/extension"
  if [ ! -d "$ext_dir" ]; then
    echo "Postgres extension directory not found: $ext_dir" >&2
    exit 1
  fi
  sudo mkdir -p "$ext_dir"
  sudo cp "$STUB_SRC"/pg_cron.control "$STUB_SRC"/pg_cron--1.0.sql \
    "$STUB_SRC"/pg_net.control "$STUB_SRC"/pg_net--1.0.sql \
    "$STUB_SRC"/supabase_vault.control "$STUB_SRC"/supabase_vault--1.0.sql \
    "$STUB_SRC"/pgmq.control "$STUB_SRC"/pgmq--1.0.sql \
    "$ext_dir"/
  echo "installed scratch extension stubs into $ext_dir"
}

if [ "$(id -un)" != "postgres" ]; then
  if ! command -v psql >/dev/null 2>&1 || ! command -v pg_config >/dev/null 2>&1; then
    echo "psql and pg_config are required" >&2
    exit 1
  fi
  bash "$ROOT/scripts/build-supabase-bundle.sh"
  install_stubs
  exec sudo -u postgres bash "$0" "$@"
fi

if ! pg_isready -q; then
  echo "local Postgres is not accepting connections" >&2
  exit 1
fi

if [ ! -f "$BUNDLE" ]; then
  echo "missing $BUNDLE" >&2
  exit 1
fi

DB_NAME="ether_hosted_priv_$$"
LOG="$(mktemp)"

cleanup() {
  dropdb --if-exists "$DB_NAME" >/dev/null 2>&1 || true
  psql -d postgres -q -c "DROP ROLE IF EXISTS ether_hosted" >/dev/null 2>&1 || true
  psql -d postgres -q -c "DROP ROLE IF EXISTS supabase_admin" >/dev/null 2>&1 || true
  rm -f "$LOG"
}
trap cleanup EXIT

echo "creating scratch database $DB_NAME"
createdb "$DB_NAME"
psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -f "$ROOT/scripts/integration-rls-bootstrap.sql"
psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -v dbname="$DB_NAME" -f "$ROOT/scripts/hosted-privilege-setup.sql"

echo "applying the bundle twice as ether_hosted"
if ! psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "SET ROLE ether_hosted" \
  -f "$BUNDLE" -f "$BUNDLE" -f "$ROOT/scripts/hosted-privilege-assertions.sql" \
  >"$LOG" 2>&1; then
  tail -n 120 "$LOG" >&2
  echo "FAILED applying the bundle as ether_hosted" >&2
  exit 1
fi

migration_count="$(find "$ROOT/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
skip_count="$(grep -c 'NOTICE:  skip ' "$LOG" || true)"
if [ "$skip_count" != "$migration_count" ]; then
  echo "expected $migration_count skip notices on the second run, got $skip_count" >&2
  grep 'NOTICE:  skip ' "$LOG" | head >&2 || true
  exit 1
fi

if ! grep -q 'skipped default privileges for supabase_admin' "$LOG"; then
  echo "missing supabase_admin default-privilege notice" >&2
  exit 1
fi
if ! grep -q 'pg_net was left outside extensions' "$LOG"; then
  echo "missing pg_net notice" >&2
  exit 1
fi
if ! grep -q 'PASS: non-member cannot change supabase_admin default privileges' "$LOG"; then
  echo "missing 42501 assertion" >&2
  tail -n 80 "$LOG" >&2
  exit 1
fi
if ! grep -q 'PASS: migration-role default privileges exclude anon and authenticated' "$LOG"; then
  echo "migration role defaults were not locked" >&2
  tail -n 80 "$LOG" >&2
  exit 1
fi

grep -E 'PASS:|NOTICE:  skipped default privileges|NOTICE:  pg_net was left' "$LOG"
echo "hosted privilege check passed ($migration_count migrations, second run skipped all)"
echo "scratch database $DB_NAME dropped after the check"
