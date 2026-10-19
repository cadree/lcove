# Stand up the empty Supabase project

Do these steps in order. This document does not run them. The project is already created:

| | |
| --- | --- |
| Project ref | `aykopqinnnssxdhxqruo` |
| Region | `us-east-1` |
| API URL | `https://aykopqinnnssxdhxqruo.supabase.co` |

The ref is not a secret. The anon key, service role key, and database password are secrets. Copy them from the dashboard. Do not put them in git or in chat.

The paused project named ETHER and the Lovable-hosted database are not used. Do not dump them and do not restore them. Users sign up again at launch.

The folder named `migration/` at the repo root is an old export for a different project (`waafzlorvnozeujjhvxu` and the Lovable ref). Do not run those SQL files.

The schema to apply is `supabase/bundle/ether-schema.sql`, built from `supabase/migrations/` in filename order. `supabase/config.toml` `project_id` is `aykopqinnnssxdhxqruo`.

## Dashboard toggles before the SQL

In project `aykopqinnnssxdhxqruo`:

### Extensions

Database, Extensions. Enable these first. The bundle's `CREATE EXTENSION IF NOT EXISTS` still errors when the extension is not allowlisted:

| Extension | Why the bundle asks for it |
| --- | --- |
| `pg_cron` | Email infrastructure checks that it exists. The bundle does not schedule a job. |
| `pg_net` | The same email migration. No `net.http_post` call is in the SQL. |
| `supabase_vault` | Vault schema. The bundle does not write a secret into it. |
| `pgmq` | Email queues `auth_emails`, `transactional_emails`, and their dead-letter queues. |

`pgcrypto` is already on hosted Supabase.

### What the bundle will not do, on purpose

These fail or leak secrets if they are pasted as SQL. They are dashboard steps after the schema and the functions exist. Details are in `docs/go-live-checklist.md`.

- **Cron jobs owned by `supabase_admin`.** Do not `cron.schedule` a command that contains `https://aykopqinnnssxdhxqruo.supabase.co` plus the service role key or `INTERNAL_FUNCTION_SECRET`. Create `process-email-queue` (every minute) and `auto-event-reminders` in Integrations, Cron. Both jobs send header `x-internal-secret`. Neither job sends the service role key. The steps are in `docs/deploy-ether-prod.md`.
- **Vault secrets owned by `supabase_admin`.** Do not `vault.create_secret` inside a file in this repo. ether-prod already has `internal_function_secret`. The email queue reads that value from the `x-internal-secret` header, not a service role key named `email_queue_service_role_key`.
- **Publication owner.** `supabase_realtime` is owned by `supabase_admin`. The bundle skips a table that is already in the publication. If this role cannot change the publication, the statement is a notice instead of a failed migration. Add the tables listed in `docs/go-live-checklist.md` under Database, Publications. Do not add `profiles`. If a notice says `profiles` could not be removed, remove it there.
- **Default privileges for `supabase_admin`.** `postgres` can change default privileges for itself. It cannot change them for `supabase_admin`. The migration skips that role and still revokes `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` for functions `postgres` creates.
- **`pg_net` in `public`.** The bundle creates `pg_net` in `extensions` when it is missing, and moves an existing install when this role owns it and the build allows `SET SCHEMA`. A permission error or a non-relocatable build leaves it where it is and raises a notice. The extension owner then runs `ALTER EXTENSION pg_net SET SCHEMA extensions`.

### Auth

Authentication, URL configuration.

- Site URL: `https://etherbylcove.com`
- Redirect URLs:
  - `https://etherbylcove.com`
  - `https://etherbylcove.com/**`
  - `https://etherbylcove.com/auth?reset=true`
  - `https://etherbylcove.com/auth?confirmed=1`
  - `com.etherbylcove.app://`
  - `capacitor://localhost`

Add the staging host the same way while you test, including `/auth?reset=true` and `/auth?confirmed=1` on that host.

Turn on email confirmation (Authentication, Providers, Email, Confirm email). Password reset returns to `/auth?reset=true`. Signup confirmation returns to `/auth?confirmed=1`.

Copy only the auth providers you will use (email, and Google if you turn it on). Client IDs and secrets stay in the dashboard.

### Storage

The bundle creates `media` (public), `contact-avatars` (private), `contact-media` (public), `board-uploads` (public), and `avatars` (private). Confirm them under Storage after the SQL runs.

Profile photos are public URLs in `media`. `avatars` is private. `delete-account` lists both names. Buckets start empty. There is no copy from the old project.

## Apply the bundle

Install nothing beyond a Postgres client. From a machine that has the database password:

```sh
bash scripts/build-supabase-bundle.sh
psql "<connection-string-for-aykopqinnnssxdhxqruo>" -v ON_ERROR_STOP=1 -f supabase/bundle/ether-schema.sql
```

Or paste `supabase/bundle/ether-schema.sql` into the dashboard SQL editor. Use the connection string from the dashboard. Do not commit it.

The file records each migration name in `public.ether_schema_migrations`. That table has RLS on and no policies. `anon` and `authenticated` have no grants. Running the file a second time skips recorded names. A scratch database that stubs auth, storage, and realtime accepted the file twice, including once as a non-superuser role that is not a member of a stub `supabase_admin`. That rehearsal does not prove hosted-only behavior: extension allowlists, `supabase_admin` ownership of `cron`, `vault`, and `supabase_realtime`, whether the installed `pg_net` can change schema, or dashboard cron delivery.

`processed_stripe_events` and `store_secrets` also have RLS on and no policies. The browser does not read them. `service_role` bypasses RLS. The function grant table is in `docs/security-definer-grants.md`.

Do not use `supabase db push` against the paused ETHER project or the Lovable project.

## Edge functions and secrets

```sh
npx supabase login
npx supabase link --project-ref aykopqinnnssxdhxqruo
npx supabase functions deploy
```

Secret names, the Stripe endpoint, and the cron jobs are in `docs/go-live-checklist.md` and `docs/stripe-setup.md`. The webhook URL is:

`https://aykopqinnnssxdhxqruo.supabase.co/functions/v1/stripe-music-webhook`

## Regenerate types

```sh
npx supabase gen types typescript --project-id aykopqinnnssxdhxqruo --schema public > src/integrations/supabase/types.ts
```

Commit the file. `src/integrations/supabase/client.ts` stays a re-export of `src/lib/supabaseClient.ts`.

## Host

Set the three `VITE_SUPABASE_` variables to this project and rebuild. Steps are in `docs/hosting-without-lovable.md`. Point `etherbylcove.com` at the host only after a preview URL signs in.
