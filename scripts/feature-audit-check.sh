#!/usr/bin/env bash
# Apply every supabase/migrations file, in filename order, to a throwaway
# local Postgres database, then run scripts/feature-audit-checks.sql.
#
# This script never reads DATABASE_URL and never opens a remote connection.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STUB_SRC="$ROOT/scripts/pg-stubs"

install_stubs() {
  local share
  share="$(pg_config --sharedir 2>/dev/null || true)"
  if [ -z "$share" ]; then
    echo "pg_config is not installed" >&2
    exit 1
  fi
  local ext_dir="$share/extension"
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
  install_stubs
  exec sudo -u postgres bash "$0" "$@"
fi

if ! pg_isready -q; then
  echo "local Postgres is not accepting connections" >&2
  exit 1
fi

DB_NAME="ether_feature_audit_$$"

cleanup() {
  dropdb --if-exists "$DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "creating scratch database $DB_NAME"
createdb "$DB_NAME"
psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -f "$ROOT/scripts/integration-rls-bootstrap.sql"

count=0
while IFS= read -r file; do
  count=$((count + 1))
  base="$(basename "$file")"
  printf '%s\n' "$base"
  if ! psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -c "SET client_min_messages TO warning" -f "$file"; then
    echo "FAILED applying $base" >&2
    exit 1
  fi
done < <(find "$ROOT/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | sort)

echo "applied $count migrations"
psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/scripts/feature-audit-checks.sql"
echo "feature audit checks passed"
echo "scratch database $DB_NAME dropped after the check"
