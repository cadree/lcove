# Go live checklist

Do these steps in order. Nothing in this branch has been applied to a hosted database. Do not run the SQL in the repo-root `migration/` folder. That folder is an old export for a different project.

Launch uses one new empty Supabase project:

| | |
| --- | --- |
| Project ref | `aykopqinnnssxdhxqruo` |
| Region | `us-east-1` |
| API URL | `https://aykopqinnnssxdhxqruo.supabase.co` |

The ref and the URL are public. The anon key, service role key, and database password are not. Copy those from the dashboard. Do not put them in git or in chat.

The paused project named ETHER and the Lovable-hosted database are not used. Do not restore their rows. People create new accounts at launch.

`cursor/ether-combined` is the pull request to merge. Do not also merge pull requests 6, 7, 8, 9, and 10 on their own, and do not push this branch straight to `main`.

## 1. Confirm the empty project

In the Supabase dashboard, open project `aykopqinnnssxdhxqruo` and confirm the region is `us-east-1`. It should have no Ether member rows. Do not link the CLI at the paused ETHER project or at the Lovable project.

## 2. Enable extensions

Dashboard, Database, Extensions. Turn these on before the schema file runs. `CREATE EXTENSION IF NOT EXISTS` still fails when an extension is not allowlisted:

- `pg_cron`
- `pg_net`
- `supabase_vault` (schema `vault`)
- `pgmq`

`pgcrypto` is already available on hosted Supabase.

## 3. Apply the schema bundle

`supabase/bundle/ether-schema.sql` is every file in `supabase/migrations/`, in filename order, wrapped so a second run skips versions already recorded in `public.ether_schema_migrations`. Rebuild it with `bash scripts/build-supabase-bundle.sh` after any migration change. Do not edit the generated file by hand.

In the dashboard SQL editor, or with `psql` against this project's connection string, run that file once. It does not connect anywhere by itself. It does not schedule cron jobs and it does not write secrets.

If a notice says this role could not change publication `supabase_realtime` (that publication is owned by `supabase_admin`), add these tables under Database, Publications, `supabase_realtime`:

`post_likes`, `post_comments`, `messages`, `typing_indicators`, `message_read_receipts`, `notifications`, `live_streams`, `stream_reactions`, `story_views`, `fund_distributions`, `conversation_participants`, `project_checklist_items`, `project_item_suggestions`, `events`, `projects`, `ticket_tiers`, `ticket_orders`, `event_attendees`, `event_check_ins`, `donations`, `stream_chat`, `board_items`.

`profiles` is not in that list. Realtime would send every column of a row the subscriber can select, including phone and exam fields that `profiles_public` omits. The landing stats query does not subscribe to `profiles`. If a notice says `profiles` could not be removed from the publication, remove it on that same screen.

`pg_net` should live in the `extensions` schema. If a notice says it was left outside `extensions`, the extension owner runs `ALTER EXTENSION pg_net SET SCHEMA extensions`. A build that does not allow `SET SCHEMA` stays where the dashboard installed it. The email migration does not call `net.http_post`.

The scratch rehearsal of this file is in the pull request. It is not a substitute for running it on `aykopqinnnssxdhxqruo`.

## 4. Auth redirect URLs and email confirmation

Dashboard, Authentication, URL configuration:

- Site URL: `https://etherbylcove.com`
- Redirect URLs:
  - `https://etherbylcove.com`
  - `https://etherbylcove.com/**`
  - `https://etherbylcove.com/auth?reset=true`
  - `https://etherbylcove.com/auth?confirmed=1`
  - `com.etherbylcove.app://`
  - `capacitor://localhost`

Add the staging host (`pages.dev` or Netlify) the same way, including `/auth?reset=true` and `/auth?confirmed=1`, while you test. Remove it when you no longer want that host to complete login.

Password reset returns to `/auth?reset=true`. Signup confirmation returns to `/auth?confirmed=1`, which is where the app saves the name and phone and continues onboarding.

Turn on email confirmation (Authentication, Providers, Email, Confirm email). Signup does not log the person in until they open the link, and the app shows "Check your email."

## 5. Storage buckets

The bundle creates these buckets:

| Bucket | Public |
| --- | --- |
| `media` | yes |
| `contact-avatars` | no |
| `contact-media` | yes |
| `board-uploads` | yes |
| `avatars` | no |

Profile photos are public URLs in `media`. `avatars` is private and exists so `delete-account` can remove leftover objects under that name. There is no storage copy from the old project. Launch starts with empty buckets.

## 6. Secrets, by name only

Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Set the rest as GitHub Actions secrets. The deploy workflow copies each name that is set and skips the rest. Do not put the values in the repo. The click path is in `docs/deploy-ether-prod.md`.

- `INTERNAL_FUNCTION_SECRET` (the existing Vault secret `internal_function_secret`, not a new value)
- `EMAIL_FROM` (optional; default `notifications@notifications.etherbylcove.com`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (from `docs/stripe-setup.md`, for this project's endpoint)
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `SITE_URL` = `https://etherbylcove.com` (use the `pages.dev` URL until the domain moves)
- `APP_URL` = `https://etherbylcove.com` (same as `SITE_URL`)

Used when those features are turned on: `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY`.

`ai-project-match` still reads `LOVABLE_API_KEY` and calls Lovable's AI gateway. It is not email. Leave the secret unset and that function fails closed. Nothing in the email queue, suppression, or preview path reads `LOVABLE_*`. Do not set `LOVABLE_SEND_URL`.

## 7. Cron jobs the bundle does not create

`cron` and `vault` objects are owned by `supabase_admin`. A cron command that named this project's URL and a secret would fail in the SQL editor and would put that secret in a file. Create the jobs in the dashboard (Integrations, Cron) after the functions are deployed and the secrets exist. Do not paste the secret into git.

- `process-email-queue`: POST `https://aykopqinnnssxdhxqruo.supabase.co/functions/v1/process-email-queue` every minute (`* * * * *`). Header `x-internal-secret` is the Vault secret `internal_function_secret`, which already exists on ether-prod. Do not send the service role key. `verify_jwt` is off. The click path is in `docs/deploy-ether-prod.md`.
- `auto-event-reminders`: POST `https://aykopqinnnssxdhxqruo.supabase.co/functions/v1/auto-event-reminders` with the same `x-internal-secret` header. Until it matches `INTERNAL_FUNCTION_SECRET`, the function returns 401 and reminders do not send.

## 8. Deploy edge functions

Deploy from GitHub Actions, not from the machine coordinating the move. That machine cannot reach Postgres and should not clone the repo. A push to `cursor/ether-combined` that changes a function, `supabase/config.toml`, or the workflow file deploys every function. GitHub does not show **Run workflow** until this file is on `main`. After `SUPABASE_ACCESS_TOKEN` is saved, open the latest **Deploy Supabase functions** run and click **Re-run all jobs**. The ordered steps are in `docs/deploy-ether-prod.md`.

The workflow runs `supabase functions deploy --use-api` (no Docker) and reads `verify_jwt` from `supabase/config.toml`. It does not run SQL. Deploy `purchase-event-with-credits` and `delete-account` before members use those buttons. `delete-account` deletes only the person whose token it is. It refuses while a payout, earned credit, escrow, store or booking payout, Stripe balance, or active subscription is still open.

Stripe webhook events are listed in `docs/stripe-setup.md`.

## 9. Regenerate database types

After the bundle has been applied on `aykopqinnnssxdhxqruo`:

```sh
npx supabase gen types typescript --project-id aykopqinnnssxdhxqruo --schema public > src/integrations/supabase/types.ts
```

Commit that file. `src/integrations/supabase/client.ts` only re-exports `src/lib/supabaseClient.ts`. If a regen replaces `client.ts`, put that re-export back.

## 10. Host the client

Follow `docs/hosting-without-lovable.md`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` (`aykopqinnnssxdhxqruo`) on the host and rebuild. Point `etherbylcove.com` only after a `pages.dev` URL signs in.

## 11. Merge

Merge this pull request into `main` when the new project signs in, a public page loads, and a test payment path is understood. Do not push the branch straight to `main`.

After the merge, check:

- `capacitor.config.ts` has no `server.url`.
- `vite.config.ts` and the `paths` in `tsconfig.json` / `tsconfig.app.json` still point `@/integrations/supabase/client` at `src/lib/supabaseClient.ts`.
- `supabase/config.toml` `project_id` is still `aykopqinnnssxdhxqruo`.

iOS submission still needs a Mac, Xcode, and a paid Apple Developer account. That list is `docs/ios-release.md`.

## 12. If the new project is wrong

Stop before changing DNS. The old ETHER backup is not the launch database. You can drop objects on `aykopqinnnssxdhxqruo` and run `supabase/bundle/ether-schema.sql` again, or create another empty project and change the ref in this checklist. Leave `INTERNAL_FUNCTION_SECRET` in place if the email queue or reminders are already scheduled. Removing it makes `process-email-queue` and `auto-event-reminders` keep returning 401.
