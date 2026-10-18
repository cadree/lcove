# Go live checklist

Do these steps in order. Nothing in this branch has been applied to the live database. Do not run the SQL in the `migration/` folder. That folder is an old export for a different project.

The five source pull requests are already combined on `cursor/ether-integration`. Land that one pull request. Do not also merge pull requests 1, 2, 3, 4, and 5 on their own, or the same edits will collide.

## 1. Back up the live database

In the Supabase dashboard for the live Ether project, take a backup and download it. Keep that file. You need it if the new migrations have to be undone. There is no undo script in this repo.

The money migration copies store payment secrets into a new table and then deletes those columns from `stores`. A backup is the way back.

## 2. Apply the migrations on a staging copy first

Create a Supabase staging branch, or a separate project restored from the backup. Do not run these files on the live project until staging looks right.

The live project already has the older files in `supabase/migrations/`. Apply only the five new files, in this order. The timestamps are already in the order that applied cleanly on a scratch database:

1. `supabase/migrations/20261018120000_open_access_and_profile_privacy.sql`
2. `supabase/migrations/20261018153000_reports_blocks_and_account_deletion.sql`
3. `supabase/migrations/20261018171500_lock_down_money_contracts_storage.sql`
4. `supabase/migrations/20261018183000_lock_event_ticket_fields.sql`
5. `supabase/migrations/20261018190000_nuance_interest.sql`

On staging, check with two accounts:

- Account A passed the exam and turned on "only show my profile to members who passed." Account B has not passed. B does not see A in the directory or on A's profile. After B passes, B can see A's name. The score is not on the public profile. B cannot see A's phone.
- A blocks B. A no longer sees B's posts. B cannot message A or follow A. A can still message B.
- A report can be filed by the reporter and read by an admin. Another member cannot read it.
- The Nuance interest list accepts a person's own email once, and only an admin can read it.
- A normal member cannot write payouts, memberships, or the other money tables, cannot read `store_secrets`, and cannot upload a file outside their own storage folder.

`scripts/integration-rls-check.sh` repeats those checks on a throwaway local Postgres. It does not connect to Supabase. It is a rehearsal, not a substitute for the staging pass.

## 3. Set the internal function secret

In Supabase, Edge Functions, Secrets, add `INTERNAL_FUNCTION_SECRET`. Pick a long random value. Do not put it in the repo or in chat.

The event-reminder cron must send that same value in the header `x-internal-secret`. Until both sides match, `auto-event-reminders` answers 401 and reminders do not send. That is intentional.

## 4. Deploy the edge functions

Deploy these two before members use the new buttons:

- `purchase-event-with-credits`
- `delete-account`

Leave `verify_jwt` on for both. `delete-account` ignores any user id in the body and deletes only the person whose token it is. It refuses while a payout, earned credit, escrow, store or booking payout, Stripe balance, or active subscription is still open.

Deploy the rest of `supabase/functions/` in the same pass so the `verify_jwt` values in `supabase/config.toml` match what is running. If the credit-ticket button ships before `purchase-event-with-credits` is deployed, the button fails. If the migration ships before that function, the old client can no longer mark a ticket purchased itself. Ship the function with the migration.

## 5. Auth redirect URLs and email confirmation

In Supabase, Authentication, URL configuration:

- Site URL: `https://etherbylcove.com`
- Add redirect URLs:
  - `https://etherbylcove.com`
  - `https://etherbylcove.com/**`
  - `https://etherbylcove.com/auth?reset=true`
  - `https://etherbylcove.com/auth?confirmed=1`

Password reset returns to `/auth?reset=true`. Signup confirmation returns to `/auth?confirmed=1`, which is where the app saves the name and phone and continues onboarding. Both have to be allowed.

Turn on email confirmation (Authentication, Providers, Email, Confirm email). With that on, signup does not log the person in until they open the link, and the app shows "Check your email."

## 6. Regenerate database types

After the staging migrations are applied, regenerate `src/integrations/supabase/types.ts` from the Supabase project you own. Do not type those columns in by hand, and do not edit the generated file to silence a type error.

```sh
npx supabase gen types typescript --project-id <project-id> --schema public > src/integrations/supabase/types.ts
```

`src/integrations/supabase/client.ts` only re-exports `src/lib/supabaseClient.ts` so a phone app does not store the session in `localStorage`. If a regen replaces `client.ts`, put that re-export back. The Vite and TypeScript path aliases are what keep native login working.

## 7. Merge

Merge the integration pull request into `main` when staging is accepted. Do not push straight to `main`. GitHub is the source of truth for this repo.

After the merge, check:

- `capacitor.config.ts` still says the app name is Ether, the bundle id is still the placeholder `com.etherbylcove.app` until you confirm it, and there is no `server.url`. A `server.url` would load a dev site inside the iOS binary.
- `vite.config.ts` and the `paths` in `tsconfig.json` / `tsconfig.app.json` still point `@/integrations/supabase/client` at `src/lib/supabaseClient.ts`.
- A second migration was not added that repeats these five files.

iOS submission still needs a Mac, Xcode, and a paid Apple Developer account. That list is `docs/ios-release.md`. This checklist does not register the bundle id.

## 8. Production, only after staging

When the staging copy behaves, repeat steps 3, 4, and 5 on the live project, apply the same five files in the same order, deploy the functions, then ship the client. Do the database and the two functions together, then the client. The fund page calls `membership_fund_snapshot`, which does not exist until the money migration has run.

## 9. Rollback

If something is wrong after production:

1. Stop sending members to the new client if the new screens are calling objects that failed.
2. Restore the database from the backup in step 1. Do not try to reverse the money migration by hand. The store secret columns are removed after they are copied.
3. Redeploy the previous edge functions so `verify_jwt` matches the restored database.
4. Leave `INTERNAL_FUNCTION_SECRET` in place. Removing it only makes reminders keep returning 401.

Old contract links that have no `?token=` stop working for anyone who is not the owner once the money migration runs. New emails from `send-contract` include the token. Restoring the backup brings the old open signing rules back.
