#!/usr/bin/env bash
# Creates a throwaway database and inserts a post as authenticated.
# objectionable_text is not granted to that role. The write fails with
# "permission denied for function objectionable_text" unless
# reject_objectionable_text is SECURITY DEFINER.
# Does not connect to a hosted or live database.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="ether_objectionable_role_$$"

if [ "$(id -un)" != "postgres" ]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "psql is not installed" >&2
    exit 1
  fi
  exec sudo -u postgres bash "$0" "$@"
fi

if ! pg_isready -q; then
  echo "local Postgres is not accepting connections" >&2
  exit 1
fi

cleanup() {
  dropdb --if-exists "$DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

createdb "$DB_NAME"
psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/scripts/objectionable-text-role-check.sql"
echo "authenticated objectionable-text write passed"
