# Release completion audit — November 16, 2026

Compared Grok's promises with `cursor/ether-combined` at `9bf4db9` and the current Supabase configuration. PR #87 was merged November 14 and PR #94 was merged November 15 by the earlier release workflow. The user initially held production, then explicitly authorized production release on November 16 after verification. Release execution is tracked below.

| Promise | Verified status |
| --- | --- |
| Short signup, email-code screen, oath instead of quiz | Already merged in #94; screenshots at 390, 820, 1280 pixels |
| “A real person will review your application…” | Already merged; kept. Removed member-photo preview from waiting screen to honor pending-member privacy |
| Production signup email includes six-digit code | Confirmed read-only: confirmation template includes `.Token`, code length 6, confirmation enabled, custom Resend SMTP configured |
| Credits, Open to, vouches, open calls | Already merged; reran the 56-check mobile browser suite successfully |
| Hide star reviews in favor of vouches | Already merged; 14-check mobile browser verification passed |
| Consistent connection notification wording | Fixed in this PR: “You connected” / “You and [name] both connected. Say hello.” in app and push. Animation and follow-up nudge use connecting language |
| No repeated phone push on repeated connect | Fixed: database returns `new_match`; client requests a push only for a new/renewed connection. Repeated active connections stay quiet |
| Pending-member database lock | Earlier file was notes only. Implemented, tested, and applied to staging. No production application |
| Staging migrations | 37 previously pending/new migrations applied in transactions; history has 217 entries through `20261116092000_pending_storage_access.sql` |
| Staging phone notification code | `send-push-notification` deployed to staging only. No notifications sent; device delivery still needs an iPhone test |
| iPhone build / TestFlight | Staging frontend built and synced. Unsigned iOS archive compiled successfully. Not uploaded to TestFlight; paired iPhones unavailable |
| Spam diagnosis | Custom SMTP, public DKIM record and DMARC monitoring record exist. These do not prove inbox delivery or identify the reason for a particular spam placement. Need a received message's authentication headers/provider delivery evidence; no production mail settings changed |
| Culture pass / new loading design | Pasted conversation gives no specification. Clarification requested; existing screens not represented as a completed redesign |

## Pending-member protection

`20261116091000_pending_member_access.sql` adds restrictive policies to current public RLS tables, checks owner-executed views, and installs a PostgREST pre-request hook for member RPCs. Applicants can read/update their own onboarding data and read onboarding catalogs. Approved, unsuspended members and admins retain their existing permissions; the gate never grants new rights. Apple reviewer accounts must be approved normally, with no email-based bypass.

`20261116092000_pending_storage_access.sql` covers Storage's separate API: pending applicants can use their own objects for onboarding, but not other members' private objects. Public media URLs and public guest pages remain public. Server/service-role operations remain trusted and bypass RLS; this is not a claim that arbitrary backend service credentials are restricted. Future member tables/views and alternate backend endpoints must preserve the gate. Another pre-request hook causes migration failure rather than being overwritten.

A staging transaction tested the full schema and rolled back its synthetic accounts. Separate real Auth/REST checks verified pending accounts can see their own profile, cannot read posts or call discovery, and cannot self-approve; active accounts can use discovery. Synthetic accounts were deleted afterward. Local PostgreSQL tests cover admin/reviewer access, suspension, storage and rollback.

## Staging email configuration

Staging now uses the existing Resend SMTP credential with the sender label **Ether staging**, six-digit OTPs, required confirmation and `supabase/templates/confirmation.html`. The user explicitly approved the credential reuse on November 16 after automatic review had initially blocked it. Production SMTP settings were not changed. Staging allows return links to the existing native bundle and local test URLs.

Verified without sending email: Auth generated and accepted a six-digit signup code. A real staging browser test confirmed that a failed profile save preserves the oath/draft, a retry saves city and creative interest, and the completed account stays pending without a redirect loop. Temporary accounts were deleted. Inbox placement still requires testing a received email.

The final browser test uncovered a pre-existing cache bug: the access gate held an old profile while onboarding saved a newer one, causing a pending/onboarding loop. Profile consumers now subscribe to updates, saves return the saved row, failed saves preserve drafts, and the waiting screen refreshes approval on focus/every 15 seconds while visible.

No test email, phone notification, or real payment was sent during these checks. Trip money remains pledges and expense tracking.

## Rollout / rollback

The November 16 user instruction authorizes release after verification. For release, apply the three new migrations in filename order and deploy `send-push-notification` alongside the frontend. Keep the database `new_match` result and frontend aligned; deploying the frontend before the migration suppresses connection push requests.

Rollback the storage policy first using `20261116092000_pending_storage_access.down.sql`, then the access gate using `20261116091000_pending_member_access.down.sql`, which restores saved view definitions and removes its hook and restrictive policies. To revert connection copy, restore the `creative_swipe` definition from `20261114160000_connect_match_notices.sql` with the previous frontend and push function. Remove corresponding entries from `ether_schema_migrations` only after successful rollback.

Protected local snapshots are under `/tmp/lcove-staging-before-20261114.json` and `/tmp/lcove-staging-before-20261116.json`. These are schema/affected-row snapshots, not full database backups. The new staging reminder-email cron job was left inactive. Keep snapshots private; they are not committed.

## Evidence

- Typecheck; lint (0 errors, 25 existing warnings); spellcheck; staging build passed.
- Unit: 649 passed. Discovery/trip database: 66. Music: 17. Invites: 41. Creative bridge: 129. Pending-access database: 28. Webhook fixtures passed.
- Screenshots in `screenshots/` use synthetic users; they are browser captures, not proof of native iPhone gestures, keyboard or push delivery.
- Native compile archive: `/tmp/lcove-release-completion-staging.xcarchive` (unsigned; not installable/uploadable as-is).
