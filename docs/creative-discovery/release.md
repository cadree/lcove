# Discovery and trip planning: verification and release

Implemented on `codex/creative-globe-trips`, targeting `cursor/ether-combined` in PR #87. The previous Apple fixes PR #86 was already merged by the time this work began; this task did not merge it. No database migration, function deployment, public release, App Store upload, or merge was performed for this feature.

## What is implemented

- `/directory`: locally rendered orthographic globe; drag/keyboard rotation and zoom; city-center profile markers/counts; city/state selector; most-active city rail; My city/Global; city/name/bio search; paginated creative cards with public work previews; swipe/tap connect or pass; reciprocal matches and chat links; unmatch, report and block. Selecting a city centers the globe; Let's travel carries that destination into trip search.
- Settings and the discovery settings panel: opt-in globe visibility and matches-only direct messages. No GPS prompt, precise coordinates, location tracking, or paid map service. Avatar imagery/fallback artwork is used instead of invented destination photography.
- Server privacy: pair-locked mutual matches reuse the personal direct chat; two-person direct-chat limit; old-thread sends/edits and participant inserts enforce DM privacy. Story replies/shares use the same RPC and fail closed. Atomic group creation rolls back when a private invite is rejected. Blocking destroys match authorization; unblocking does not restore it. Read/mute updates still work after unmatching.
- `/travel`: destination/date filtering, roster preview, capacity, explicitly joined group chats, idempotent creation, itemized quotes in USD, deterministic equal shares, pledges, separately self-reported outside payments, versioned unanimous budget approval, receipt links/actual costs, per-member confirmation/dispute, cancellation and completed status after trip dates. Trip budget link appears inside the group chat.
- A roster/budget change clears pledges and approvals. Receipt entry requires everyone's approval; overspending beyond the approved estimate is rejected. Recorded bookings freeze roster and budget. Repeat votes do not count twice. Personal trip budgets and chats are member-only even under legacy permissive chat policies, and organizers cannot make these chats public.
- Existing server text moderation is reused for trip plans/items. Profiles can be reported/blocked from discovery; trip organizers can be reported from trip listings. Banned/suspended organizers' trips are hidden from prospective travelers.
- Account deletion is not blocked by planning pledges. The existing service-only purge is wrapped to cancel affected active trips and remove/anonymize personal records before the original cleanup. Deletion is an intentional exception to retaining receipt evidence.
- Privacy page explains discovery, matching, listings, private budgets and planning-only payments. App privacy manifest adds linked, non-tracking Other Financial Info for budget/pledge/payment records, used for app functionality. Existing coarse location and purchase-history disclosures remain.

## What this version deliberately does not do

Per the user's choice, it does not collect or hold money, release funds, book suppliers, guarantee reservations, or verify outside payments. Quotes and receipt links are entered by travelers, not live prices from a booking API. There is no escrow, wallet, Stripe trip checkout, or automatic Airbnb/car-rental payment. Matching a destination recommends a trip group; the traveler must explicitly join that particular plan and dates. Only USD/equal shares are supported initially. There is no silent currency conversion.

Existing public profile visibility is separate from globe opt-in. Turning discovery off does not erase an existing public profile or an established match. Unmatching removes the match, but an account choosing Open DMs can still receive ordinary messages; use Block to stop that person entirely.

## Checks performed locally

- `npm run typecheck`: passed.
- `npm run lint`: passed, 0 errors; 22 pre-existing warnings.
- `npm run lint:spell`: passed.
- `npm run test:unit`: 451 passed.
- `npm run test:webhook`: 29 passed; no payment webhook changes.
- `npm run test:discovery-db`: 26 PostgreSQL checks using PGlite. Applies both new migration files against a representative minimal schema, plus the real existing direct-chat RPC and text-moderation function. Covers privacy, matching, replay/idempotency, permissions, approvals, exact-cent allocation, private groups, deletion and receipt state transitions. This is not a full replay of every historical Supabase migration and does not simulate multiple production database connections.
- `npm run build`: passed with non-production fixture environment values; existing bundle-size/Browserslist warnings. This compile-check bundle must not be synced/uploaded as a real app build.
- `plutil -lint ios/App/App/PrivacyInfo.xcprivacy`: passed.
- Chrome/Playwright at 390, 820 and 1280 pixels: globe rotation/city selection, mutual-like response/chat action, matches-only setting mutation, trip budget, pledge submission, creation dialog and full create form submission. No horizontal document overflow or page errors. Uses intercepted fixture responses; it does not prove staging transactions or actual device behavior.
- Screenshots in `docs/creative-discovery/screenshots/` use synthetic profiles/cities and intentionally exercise missing-avatar/work fallbacks. They are test artifacts, not real member counts.

## Manual staging rollout (before enabling the UI)

Use the previously identified **ether-staging**, project reference `vjdrihmriufkameqngfg`. Confirm the selected project in the dashboard. Do not substitute ether-prod.

1. Review schema prerequisites from the current base branch, including `profiles_public`, `either_blocked`, personal direct-chat RPC, objectionable-text filter, conversation visibility/community fields and `purge_user_personal_data(uuid)`. The staging environment was previously missing some Apple-fix migrations/functions; resolve that existing setup separately. Do not blindly replay the complete migration history.
2. Back up staging, then manually review/apply `supabase/migrations/20261114090000_creative_discovery.sql` and `supabase/migrations/20261114091000_travel_pledges.sql` in that order. They are transactional, one-time migrations; the second wraps/renames the existing personal-data purge and adds a trigger on `auth.users`, so it needs the appropriate database-owner privileges. Stop and inspect any failed prerequisite rather than editing production.
3. Deploy/build this PR only after the migrations are present. Group creation now requires `create_group_with_privacy`; the frontend intentionally has no insecure fallback if that RPC is absent. No new API keys, payment secrets, or new edge functions are required for this version.
4. Use at least three disposable accounts with completed profiles. Discovery starts off for everyone; explicitly enable it for test users. Verify a single like is private, two likes produce exactly one personal chat, private recipients reject unrelated DMs/story replies/shares/old-thread messages, unmatch/block works, and project/collective messaging remains functional. Test simultaneous likes in separate sessions on real PostgreSQL.
5. Have four users join a trip. Add $1,500 lodging and $500 transport: each owes $500. Check duplicate creation/join requests, capacity, blocked roster, changes invalidating approvals, all-member approval, rejection of over-budget receipts, each-person confirmation, a dispute reopening completion, cancellation, and account deletion. Try raw API mutations as a non-member too.
6. Verify existing report delivery/admin moderation and inspect the SQL permission audit. Confirm the report-email worker already needed by the Apple fixes is configured. This work did not verify live email delivery.

## iPhone and App Store Connect follow-up

Follow `docs/iphone-app-store-walkthrough.md` for the existing app identity/signing steps. Rebuild the web bundle with the intended staging URL/project/anon environment, then `npx cap sync ios` before an internal device build. Do not use the compile-check `dist` bundle with fixture credentials, and do not assume the older staging archive includes these new screens. No new signed archive was produced in this task.

On a real iPhone, test globe drag/tap controls, city rail scrolling, left/right profile gestures versus vertical scroll, profile/work links, report/block, and keyboard access to the trip form and receipt fields. Test VoiceOver, larger text, safe areas, loss/recovery of network and a second account for mutual matching. Check group-chat budget navigation and the full approval flow on separate devices.

Before an App Store submission, reconcile App Privacy answers with the feature: coarse profile city; identity-linked user content/matching; trip purchase records; and Other Financial Info for pledges, budgets and self-reported contributions. Review the complete app data inventory, not just this feature. Apple reference: https://developer.apple.com/app-store/app-privacy-details/ and https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype . The new manifest is a declaration, not an App Store Connect update or an approval guarantee. Use the existing app entry, a higher unused build number and an appropriate reviewer account after staging passes. No submission or release has been made.
