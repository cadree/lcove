#!/usr/bin/env bash
# Throwaway database ether_admin_test. Does not connect to a hosted project.
# Needs local Postgres (peer auth as the postgres user) and a PostgREST binary.
#   POSTGREST_BIN=/tmp/postgrest bash scripts/admin-console-local-test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${ADMIN_CONSOLE_PORT:-54330}"
BIN="${POSTGREST_BIN:-postgrest}"
SECRET="ether-admin-console-test-secret-ok"
PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1)

if ! command -v "$BIN" >/dev/null 2>&1 && [[ ! -x "$BIN" ]]; then
  echo "PostgREST binary not found. Set POSTGREST_BIN." >&2
  exit 1
fi

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS ether_admin_test;"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE ether_admin_test;"
"${PSQL[@]}" -d ether_admin_test -f "$ROOT/scripts/admin-console-test-bootstrap.sql"
"${PSQL[@]}" -d ether_admin_test -f "$ROOT/supabase/migrations/20261024120000_admin_console.sql"
"${PSQL[@]}" -d ether_admin_test -f "$ROOT/scripts/admin-console-privilege-check.sql"

"${PSQL[@]}" -d ether_admin_test <<'SQL'
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'member@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'target@example.test');
INSERT INTO public.profiles (user_id, display_name, access_status, created_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Admin', 'active', now() - interval '40 days'),
  ('22222222-2222-4222-8222-222222222222', 'Member', 'active', now() - interval '2 days'),
  ('33333333-3333-4333-8333-333333333333', 'Target', 'active', now() - interval '10 days');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin');
INSERT INTO public.posts (id, user_id, content) VALUES
  ('01999999-0000-4000-8000-000000000010', '33333333-3333-4333-8333-333333333333', 'A real photograph of the room');
INSERT INTO public.content_reports (id, reporter_id, target_type, target_id, reason, status) VALUES
  (
    '01999999-0000-4000-8000-000000000014',
    '22222222-2222-4222-8222-222222222222',
    'post',
    '01999999-0000-4000-8000-000000000010',
    'Fake or AI-generated person',
    'open'
  );
INSERT INTO public.ticket_orders (total_cents, refund_amount_cents, payment_method, payment_status, stripe_payment_intent_id)
VALUES (2500, 0, 'stripe', 'paid', 'pi_test_admin_console');
SQL

"${PSQL[@]}" -d ether_admin_test -c "ALTER ROLE authenticator WITH LOGIN PASSWORD 'authenticator';"

PGRST_DB_URI="postgres://authenticator:authenticator@127.0.0.1:5432/ether_admin_test" \
  PGRST_DB_SCHEMAS=public \
  PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$SECRET" \
  PGRST_DB_CHANNEL_ENABLED=false \
  PGRST_SERVER_PORT="$PORT" \
  "$BIN" >/tmp/ether-admin-postgrest.log 2>&1 &
PGRST_PID=$!
cleanup() {
  kill "$PGRST_PID" >/dev/null 2>&1 || true
  wait "$PGRST_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "$ready" -ne 1 ]]; then
  echo "PostgREST did not start" >&2
  cat /tmp/ether-admin-postgrest.log >&2 || true
  exit 1
fi

node "$ROOT/scripts/admin-console-http-check.mjs" "http://127.0.0.1:${PORT}"
