# Apple fixes: manual rollout and device verification

No production database changes or deployments are performed by this PR.

## Moderation alerts

1. Apply `supabase/migrations/20261105120000_content_report_alerts.sql` manually after reviewing it. The SQL trigger function queues one alert for each distinct account with `public.user_roles.role = 'admin'` and an email in `auth.users`. Confirm the Ether admin has that role and a monitored email before enabling the trigger.
2. Reuse the existing `process-email-queue` Edge Function. Verify its secrets `RESEND_API_KEY`, `INTERNAL_FUNCTION_SECRET`, and verified `EMAIL_FROM` are configured; Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. No new email provider or secret is needed.
3. Verify the existing dashboard Cron job runs every minute (`* * * * *`), POSTs to the project's `/functions/v1/process-email-queue`, and sends `x-internal-secret` matching Vault's `internal_function_secret` and the Edge Function's `INTERNAL_FUNCTION_SECRET`. See `docs/deploy-ether-prod.md`. Never put secret values in SQL committed to Git.
4. In staging, submit a report as an ordinary user, check `email_send_log` for `content-report-alert`, and confirm receipt by the admin. Ensure that recipient is not suppressed. Monitor the transactional dead-letter queue: the existing worker retries delivery and moves expired/failed mail there (default transactional TTL: 60 minutes).
5. Staff the stated 24-hour moderation response. Email delivery alone does not enforce response time.

The trigger enqueues transactionally: queue failures roll back the report insert rather than silently losing its alert. No report body or reporter identity is sent by email.

## Store classification and iOS purchases

Apply `20261105121000_store_item_digital_classification.sql` before releasing the updated web/native bundle or `purchase-store-item` function. Existing and imported listings start with `is_digital = NULL`; owners must edit each listing and choose its delivery type. Do not bulk-label unknown inventory physical. Web checkout is unchanged; iOS hides digital/unclassified catalog listings and blocks their cash, credits, and external purchase actions, including direct product links. My Store keeps listings visible for owner classification. Rentals remain real-world services unless explicitly marked digital. The function additionally rejects requests declaring `clientPlatform: ios`; that client hint is not an authentication boundary.

## App Store metadata and privacy

`PrivacyInfo.xcprivacy` is included in the App target Resources. `TARGETED_DEVICE_FAMILY` remains 1. The manifest declares no tracking or tracking domains, account/contact data, city, account/device identifiers (push registration), uploaded photo/video/audio/message and other content, transaction history, interaction records, manually entered CRM contacts, and other profile data (birthday/skills). All are linked to the account and used for app functionality. See `Auth.tsx`, `usePushNotifications`, `usePosts`, `useMessages`, pipeline contacts, store orders, and the profile customization schema. Confirm the App Store Connect privacy answers against the final shipped build and production services.

The required-reason API audit of the installed Capacitor 8 plugins and app Swift sources found UserDefaults in Preferences (`CA92.1`, app-owned preference/session storage). No file timestamp or system boot-time API use was found, so `C617.1` and `35F9.1` were not added speculatively. Recheck Xcode's archive privacy report for linked binary dependencies before submission. Apple reference: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype

The owner must verify the export-compliance declaration (`ITSAppUsesNonExemptEncryption = false`), App Privacy answers, support/privacy URLs, reviewer test account and group-chat instructions in App Store Connect. Archive/sign/upload from Xcode and test on real iPhone hardware; this PR does not submit a binary.

## Verification performed

- `npm run typecheck`: passed.
- `npm run lint`: passed with 22 warnings and no errors.
- `npm run lint:spell`: passed.
- `npm run test:unit`: 448 tests passed.
- `npm run test:webhook`: 29 fixtures passed.
- `npm run build`: passed (bundle-size/Browserslist warnings).
- `plutil -lint`: Info.plist, PrivacyInfo.xcprivacy and project.pbxproj passed. Both device-family settings remain `1`.
- `scripts/apple-fixes-browser-check.mjs`: Chrome with mocked Supabase at 390, 820 and 1280 pixels; verified group validation, dialog width and reduced viewport bounds, persistent Post/Story composers, Store/Board/Collective/Cinema creation links, clearing/replacing/clamping role slots, and profile size controls. Signup consent was verified at 390 pixels. Screenshots are under `docs/apple-fixes-screenshots/`. These are browser simulations, not iOS device screenshots.

To reproduce browser checks, run Vite with dummy `VITE_SUPABASE_URL=https://apple-fixes-test.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY=local-mock-key`, then run `node scripts/apple-fixes-browser-check.mjs /tmp/apple-fixes-shots`. It intercepts Supabase requests; do not use this as a production backend test. Chrome must be installed (or set `SHOT_BROWSER` to another installed Playwright channel).

## Still requires a human / real device

- Apply both new migrations in order, verify admin role/email and queue/Resend configuration, then prove a report reaches the monitored inbox. No SQL or Edge Functions were executed against Supabase during this work.
- Classify existing/imported store listings before iOS release; deploy the updated purchase function only as part of a separately authorized release.
- On an iPhone: keyboard opening/closing and rotation in music/project/dialog/sheet fields; notch/home-indicator clearance; grip dragging versus taps; real HEIC and audio upload; Save Changes then reload the profile to verify music and cover art; digital checkout blocked and physical purchase still available. Test the reviewer’s group-chat flow with real users and an iPad-width layout.
- Exercise `?conversation=`, `?new=<userId>` and `?id=` with authorized backend records; browser mocks do not prove real conversation creation, RLS or project access.
- Build/archive in Xcode, inspect the archive privacy report and included app manifest, verify export compliance and privacy metadata, and submit through App Store Connect. No native binary/archive was built or submitted here.
