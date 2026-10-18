#!/usr/bin/env bash
# Creates a throwaway Postgres database, applies the safety migration, and checks RLS.
# Does not connect to a hosted or live database.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="ether_safety_rls_$$"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed" >&2
  exit 1
fi

cleanup() {
  dropdb --if-exists "$DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

createdb "$DB_NAME"
psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/scripts/safety-rls-check.sql"
echo "scratch database $DB_NAME dropped after the check"
