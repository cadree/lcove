# Move Ether off Lovable Cloud onto a Supabase project you own

Do these steps in order. This document does not run them. Do not point it at the live database until a staging project has been checked.

The folder named `migration/` at the repo root is an old export for a different project. Do not run those SQL files. The schema to apply is `supabase/migrations/`.

The Supabase project ref currently written in `supabase/config.toml` is the Lovable Cloud project. Linking the CLI to a new project does not delete the old one. Keep the old project until the new one has your data and the site is using it.

## 1. Create the new project

In the Supabase dashboard, create a project in your own organization. Pick a region close to the people who use Ether. Save the project ref, the project URL, and the anon public key somewhere private. You will need the database password for the export and for the CLI.

Turn on the same Postgres extensions the migrations expect before you apply them. The migrations create `pg_net`, `pg_cron`, `supabase_vault`, and `pgmq` where the files ask for them. On a hosted Supabase project those extensions are available from the dashboard (Database, Extensions). Enable them if `db push` stops on a missing extension.

## 2. Export the data you want to keep

In the old project (Lovable Cloud), take a backup from the dashboard and download it before you change anything.

To copy rows yourself, use `pg_dump` from your machine against the old project's connection string. Prefer the data-only form so the new project's schema comes from this repo, not from a dump of the old database:

```sh
pg_dump --data-only --no-owner --no-privileges --format=custom --file=ether-data.dump "<old-database-url>"
```

Do not commit that dump. It contains member rows. If a table in the dump does not exist yet on the new project, restore it only after step 3.

A full `pg_dump` (schema and data) is a backup, not the way to build the new project. Restoring a full dump on top of `db push` will fight the migrations.

## 3. Apply the migrations with the CLI

Install the Supabase CLI (`npx supabase` is enough). From the repo root:

```sh
npx supabase login
npx supabase link --project-ref <new-project-ref>
npx supabase db push
```

`db push` applies every file in `supabase/migrations/` that the new project does not already have, in filename order. Read the output. If it stops, fix the cause on the new project and run it again. Do not apply a partial file by pasting it into the SQL editor unless you also record that the CLI history matches.

Then run the local rehearsal on your machine, which never connects to Supabase:

```sh
bash scripts/integration-rls-check.sh
```

## 4. Restore the data

After the migrations have created the tables:

```sh
pg_restore --data-only --no-owner --no-privileges --dbname="<new-database-url>" ether-data.dump
```

If `pg_restore` reports a row that violates a new check or foreign key, stop and look at that table. Do not disable row level security to make the restore succeed. The restore connection uses the database password, which bypasses RLS. The app does not.

Sign in on a staging URL and confirm a known account can see its profile, messages, and events.

## 5. Redeploy the edge functions

From the repo root, with the CLI still linked to the new project:

```sh
npx supabase functions deploy
```

That publishes every function under `supabase/functions/`. `supabase/config.toml` sets `verify_jwt` per function. Deploying from this repo is what makes the new project match those flags.

Deploy `purchase-event-with-credits` and `delete-account` before members use those buttons. The details are in `docs/go-live-checklist.md`.

## 6. Set secrets by name

Supabase injects these into every function. You do not paste them yourself:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Set the rest under Edge Functions, Secrets, on the new project. Copy the values from the old project's secrets. Do not put the values in git, in this doc, or in chat.

Required for the features that call them:

- `INTERNAL_FUNCTION_SECRET` (new value is fine; the reminder cron must send the same value)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (the signing secret from step 9, not the old endpoint's secret)
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`

Used when those features are turned on:

- `SITE_URL` (set to `https://etherbylcove.com`)
- `APP_URL` (set to `https://etherbylcove.com`)
- `APPLE_PASS_TYPE_ID`
- `APPLE_TEAM_ID`
- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY`

Still read by email and matching functions that were not rewritten:

- `LOVABLE_API_KEY`

Leaving Lovable hosting does not remove those calls. `process-email-queue`, `handle-email-suppression`, `preview-transactional-email`, and `ai-project-match` still ask for `LOVABLE_API_KEY`. Copy it if those functions must keep working. Replacing that provider is a separate change.

## 7. Auth redirect URLs

In the new project: Authentication, URL configuration.

- Site URL: `https://etherbylcove.com`
- Redirect URLs:
  - `https://etherbylcove.com`
  - `https://etherbylcove.com/**`
  - `https://etherbylcove.com/auth?reset=true`
  - `https://etherbylcove.com/auth?confirmed=1`
  - `com.etherbylcove.app://`
  - `capacitor://localhost`

Add the staging host as well (the `pages.dev` or Netlify URL) while you test, including `/auth?reset=true` and `/auth?confirmed=1` on that host.

Turn on email confirmation (Authentication, Providers, Email, Confirm email) so signup waits for the link. Password reset returns to `/auth?reset=true`. Signup confirmation returns to `/auth?confirmed=1`.

Copy auth providers you actually use (email, Google, or others) from the old project. Client IDs and secrets stay in the dashboard.

## 8. Storage buckets

The migrations create these buckets when they run:

| Bucket | Public |
| --- | --- |
| `media` | yes |
| `contact-avatars` | no |
| `contact-media` | yes |
| `board-uploads` | yes |

`delete-account` also lists an `avatars` bucket. Create `avatars` in the dashboard if the old project has one and member photos live there. The migration files in this repo do not create it.

Files are not in the SQL dump unless you used a storage export. Copy objects with the Supabase storage API or the dashboard, bucket by bucket, keeping the same object paths. Profile photos and board uploads break when the paths change.

## 9. Reconnect Stripe webhooks

In the Stripe dashboard, add an endpoint for the new function. Do not delete the old endpoint until the new site is the one taking payments.

- URL: `https://<new-project-ref>.supabase.co/functions/v1/stripe-music-webhook`
- Events the function handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

Stripe shows a signing secret once. Store it as `STRIPE_WEBHOOK_SECRET` on the new project (step 6). The old secret only verifies events sent to the old endpoint.

Other payments (tickets, memberships, store, fund) create a Checkout session and then the app calls a `verify-*` function with that session. Those do not read `STRIPE_WEBHOOK_SECRET`. They still need `STRIPE_SECRET_KEY` on the new project. Stripe Connect accounts stay on the same Stripe platform account; you do not create new Connect accounts for existing members if you keep the same `STRIPE_SECRET_KEY`.

## 10. Point the site at the new project

On the host (see `docs/hosting-without-lovable.md`), set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Rebuild. The browser bundle only talks to the project that was set at build time.

Update `supabase/config.toml` `project_id` to the new ref in a pull request when you want the CLI default to match. Do that after the link works, not before the backup.

## 11. Regenerate types

```sh
npx supabase gen types typescript --project-id <new-project-ref> --schema public > src/integrations/supabase/types.ts
```

Commit the file. See the README for why `client.ts` stays a re-export.

## 12. Cut over

Use a staging hostname until sign-in, a message, a public event page, and a Stripe test payment succeed. Then add `etherbylcove.com` to the new project's auth redirects, deploy the client with the new env vars, and change DNS using the record the host shows you. Keep the old Supabase project and the database dump until you have watched the new project for a billing cycle.
