# Pending application vouches and recovery — November 17, 2026 (rechecked November 21)

Changes are on `codex/pending-vouch-recovery`. Production release is held until the remaining staging gates pass.

## Implemented

- Pending applicants can copy/share an endorsement request for an already-submitted application. This is separate from inviting a new applicant.
- Approved, non-suspended members can endorse once with an optional 280-character note. Self-vouches, pending members, anonymous users, and closed applications are rejected. Retrying does not duplicate the endorsement.
- Admin review shows endorser identity, date, and note. No table access is granted to public clients; RPCs check the current caller.
- Sign-in preserves a valid vouch return path. Pending screen explains safe sign-out and resuming with the original account.
- Recovery email input remains editable after a syntactically valid partial address; the existing latest-branch unconfirmed-login recovery and resend cooldown remain.
- Review user list uses document scrolling, extending the existing dashboard fix.
- Landing circles replaced by three static silver logo images (about 124 KB total).

## Staging evidence

Project: `vjdrihmriufkameqngfg` only. Migration `20261117203615_membership_vouch_links.sql` applied to staging.

- PASS: actual browser sign-out and password sign-in restored `/pending` and the same vouch link without a verification code.
- PASS: approved member submitted a vouch; reload showed it already recorded; admin saw the same member and note at 390px, without horizontal overflow.
- PASS: real staging REST requests let admin enable/disable the application push preference and rejected a non-admin enabling it.
- PASS: application email delivered through the scheduled worker to `etherbylcove@gmail.com` Inbox at 20:43:01 UTC. Gmail message `1a1eb3fb0ebb884c`; application message key `ether-application-d72db42d-4730-4cab-8f50-4713c0a62b37-97d5f1c251c39f1634a27e5d0cb88010`. Exactly one sent log and one Gmail result; repeated saves did not enqueue another application alert.
- PASS: no Edge Function warning/error entries during the test window starting 20:40 UTC. Routine boot/shutdown entries are present.
- PASS: PGlite vouch access/deduplication tests; 8 existing referral, push preference, push dispatch, and admin scroll tests; 6 access-routing/cooldown tests; typecheck; lint (25 pre-existing warnings, no errors); spellcheck; staging production build.

## November 21, 2026 recheck (staging `vjdrihmriufkameqngfg`)

Branch merged with `cursor/ether-combined` at `03a1990` (no conflicts).

- FIXED: `RequestVouchCard` was imported but not rendered on `/pending`, so applicants had no vouch link. It is rendered again, and the staging browser flow now passes.
- FIXED: shared vouch links use `VITE_PUBLIC_WEB_ORIGIN` (`src/lib/publicWebOrigin.mjs`). Production stays the default. A build on any other Supabase project gets no link unless it names a non-production origin, and a production build refuses a non-production origin. Unit tests cover both directions; a staging native bundle embeds the staging origin.
- PASS (SMTP fixed): fresh signup `etherbylcove+stg20261121@gmail.com` got a 6-digit code in the Gmail inbox within a second; a wrong code returned 403; password sign-in before verifying returned `email_not_confirmed`; resend returned 200 and delivered a new code; an immediate second resend returned 429 (`over_email_send_rate_limit`); the new code verified and password sign-in then succeeded. No SMTP or 535 errors in auth or function logs since Nov 18; only expected invalid-code and unconfirmed-login warnings.
- PASS: application alert for that applicant was sent once to `etherbylcove@gmail.com` (Gmail inbox, 15:22 UTC) although the profile was submitted again by the retry; queues and dead-letter queues are empty; no duplicate `sent` message ids.
- PASS: `scripts/staging-vouch-flow-check.mjs`: sign-out/sign-in returns to `/pending` with the same link; member vouch with note persists and a retry shows it recorded; admin sees member and note at 390px with no horizontal overflow; exactly one vouch row; applicant stays `pending`.
- PASS: hosted checks: migration recorded; RLS on both tables; no `anon`/`authenticated`/`PUBLIC` table grants; the four RPCs are `SECURITY DEFINER` with `search_path=""` and executable only by `authenticated`; pending guard allows `get_my_membership_vouch_link`.
- PASS: admin `/admin` and `/admin/onboarding` at 390px scroll as one document with no nested scroll areas and no horizontal overflow.
- PASS: typecheck; lint (0 errors, 25 existing warnings); 663 unit tests; spellcheck; staging build; `scripts/membership-vouch-db.test.mjs`.

Production admin recipients: the only admin is `etherbylcove@gmail.com`, which is also the fixed review inbox, so each application sends one email. Its application push preference is off in production (and staging), so no application pushes will be sent until an admin turns it on.

## Release blocker: iPhone push (not verified)

- Sender now picks the APNs host from the `APNS_ENV` secret: `sandbox`/`development` uses `api.sandbox.push.apple.com`, anything else production. Production has no `APNS_ENV`, so it is unchanged. Deployed to staging only.
- Staging secrets set: `APNS_ENV=sandbox`, `APPLE_TEAM_ID` (same value as production, checked by digest). Still missing in staging: `APPLE_APNS_KEY_P8`, `APPLE_APNS_KEY_ID`. No `.p8` exists on the Mac, and Supabase never returns secret values, so they must be added from the Apple Developer key file.
- `ios/App/App/App.staging.entitlements` (`aps-environment=development`, no app links) is used only by `scripts/ios-staging-build.sh`; the committed `App.entitlements` still says production. A development-signed staging build compiled and signed with `aps-environment=development`.
- Both paired iPhones show `unavailable`, so nothing was installed. Registration, delivery, tap navigation, preference suppression and duplicate checks on a real iPhone are not done. Production release is held.

## November 21 iPhone push run 1 (staging app on Cadre's iPhone)

- PASS: sandbox token saved; `send-push-notification` returned `sent: 1` from sandbox APNs; application push with the admin preference on delivered once (one `application_push_deliveries` row, no duplicate on re-save); with it off the worker sent nothing. Cadre confirmed both pushes arrived.
- FAIL: tapping did not navigate (Calendar test did nothing; application push left him on his profile). Root cause: the app never listened for `pushNotificationActionPerformed`, so taps only opened the app where it was.
- FIX: `src/lib/pushTap.ts` adds the listener at startup in `main.tsx` (before React, so a cold-start tap that Capacitor retains is not lost); `src/lib/pushTapRoute.mjs` maps the APNs payload `url` to an in-app path and holds it until `PushTapNavigator` (inside the router) navigates. Unit tests cover the sender payload to route mapping and cold-start/background/foreground delivery. A rerun on the phone is pending.

## Assets

Built-in image generation edited each supplied logo separately with this prompt:

> Edit the provided logo into a polished silver metal emblem for a small website icon. Preserve its exact silhouette, proportions, internal linework and negative spaces. Front facing orthographic, restrained beveled edges, bright silver studio highlights, subtle dark metal reflections. Center tightly in a square with 8% padding, logo fills the canvas. Actual transparent background, no white background, no text, no added objects. No redesign.

Project assets: `src/assets/brand/silver-lotus.png`, `silver-lcove.png`, `silver-star.png`. Sized to 256px for delivery; full originals remain in Codex generated images.
