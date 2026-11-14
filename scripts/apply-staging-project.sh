#!/usr/bin/env bash
# Apply supabase/bundle/ether-schema.sql and supabase/seed/staging.sql
# to a free staging Supabase project.
#
# Refuses ether-prod (ref aykopqinnnssxdhxqruo). Does not print the
# connection string or the seed password. A failed psql run can still
# echo the SQL statement in this terminal, including the seed password.
# Run it on your own machine, not in a shared log.
#
#   STAGING_PROJECT_REF=... \
#   STAGING_DB_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres' \
#   STAGING_SEED_PASSWORD='...' \
#   bash scripts/apply-staging-project.sh
#
# --check validates the variables and does not connect.
# --schema-only skips the seed. --seed-only skips the schema.
# --no-rebuild uses the bundle already in supabase/bundle.
set -euo pipefail

PROD_REF="aykopqinnnssxdhxqruo"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

mode="all"
check_only=0
rebuild=1

usage() {
  cat <<'EOF'
Usage: bash scripts/apply-staging-project.sh [--check] [--schema-only | --seed-only] [--no-rebuild]

Environment:
  STAGING_PROJECT_REF     20-letter staging ref. ether-prod is refused.
  STAGING_DB_URL          Postgres URI from the staging dashboard. Not printed.
  STAGING_SEED_PASSWORD   Shared password for the two seed accounts. Required unless --schema-only.
EOF
}

refuse() {
  echo "apply-staging-project: $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) check_only=1 ;;
    --schema-only)
      if [[ "$mode" != "all" ]]; then
        refuse "use only one of --schema-only and --seed-only"
      fi
      mode="schema"
      ;;
    --seed-only)
      if [[ "$mode" != "all" ]]; then
        refuse "use only one of --schema-only and --seed-only"
      fi
      mode="seed"
      ;;
    --no-rebuild) rebuild=0 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

ref="${STAGING_PROJECT_REF:-}"
url="${STAGING_DB_URL:-}"
password="${STAGING_SEED_PASSWORD:-}"

[[ "$ref" =~ ^[a-z]{20}$ ]] || refuse "STAGING_PROJECT_REF must be the 20-letter staging project ref"
[[ "$ref" != "$PROD_REF" ]] || refuse "refusing ether-prod ref ${PROD_REF}"
[[ -n "$url" ]] || refuse "STAGING_DB_URL is required. It is the Postgres URI, and it is not printed."
[[ "$url" != *"$PROD_REF"* ]] || refuse "STAGING_DB_URL contains the ether-prod ref ${PROD_REF}"
[[ "$url" != *":6543"* ]] || refuse "port 6543 is the transaction pooler. Use the direct connection or the session pooler on port 5432."

url_matches=0
[[ "$url" == *"db.${ref}.supabase.co"* ]] && url_matches=1
[[ "$url" == *"postgres.${ref}:"* || "$url" == *"postgres.${ref}@"* ]] && url_matches=1
[[ "$url_matches" == 1 ]] || refuse "STAGING_DB_URL does not contain staging ref ${ref} as db.${ref}.supabase.co or postgres.${ref}"

if [[ "$mode" != "schema" ]]; then
  [[ "${#password}" -ge 8 ]] || refuse "STAGING_SEED_PASSWORD must be at least 8 characters"
  [[ "$password" != *$'\n'* ]] || refuse "STAGING_SEED_PASSWORD cannot contain a newline"
fi

if [[ "$check_only" == 1 ]]; then
  echo "staging target ${ref} accepted (${mode})"
  exit 0
fi

command -v psql >/dev/null 2>&1 || refuse "psql is required"

if [[ "$mode" != "seed" && "$rebuild" == 1 ]]; then
  bash "$ROOT/scripts/build-supabase-bundle.sh"
fi

if [[ "$mode" != "seed" ]]; then
  echo "applying schema bundle to staging ref ${ref}"
  psql --no-psqlrc "$url" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/bundle/ether-schema.sql"
fi

if [[ "$mode" != "schema" ]]; then
  echo "applying staging seed to ref ${ref}"
  psql --no-psqlrc "$url" -v ON_ERROR_STOP=1 \
    -v staging_project_ref="$ref" \
    -v seed_password="$password" \
    -f "$ROOT/supabase/seed/staging.sql"
fi

echo "staging ref ${ref} is ready"
