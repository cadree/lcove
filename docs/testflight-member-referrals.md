# ETHER membership-referral TestFlight candidate

This release extends the already-merged ETHER review flow with member vouches, pending-applicant referrals, and Familcy acceptance notifications.

## Apple identity — do not change

- Existing App Store Connect app: **ETHER by LCOVE**
- Apple ID: **6758372010**
- Team ID: **926NTNU4M7**
- Bundle ID: `app.lovable.e07d9c457fd949f78f3cc7d5998be668`
- Marketing version: `1.0.1`; Xcode project build number incremented from 2 to 3

Do not create another app, new bundle identifier, or distribution team. Publishing an iOS build to TestFlight is **not** the same as launching it on the public App Store.

## GitHub macOS build

Workflow: [Build ETHER for iPhone TestFlight](../.github/workflows/ios-testflight.yml).

It runs for each push to the feature branch, builds the Vite app using the **existing ether-prod public client** configuration, runs the unit and member-referral tests, syncs Capacitor's iOS assets, and compiles the native iOS simulator target using Xcode. If the compile succeeds, it publishes the `ether-ios-simulator-unsigned` artifact for macOS developer QA. **That simulator artifact cannot be installed through TestFlight or directly on an iPhone.**

The workflow attempts the signed Apple archive and upload **only when all three App Store Connect API credentials are configured** as GitHub Actions secrets:

- `APP_STORE_CONNECT_KEY_ID` — Apple App Store Connect **Team Key** identifier
- `APP_STORE_CONNECT_ISSUER_ID` — Team issuer UUID
- `APP_STORE_CONNECT_API_KEY_P8` — full contents of the API Key's `.p8` file (keep private)

Configure them in [GitHub Actions secrets](https://github.com/cadree/lcove/settings/secrets/actions). Do not paste keys or provisioning certificates in chat or commit them to Git. The key must belong to the existing Apple team and have sufficient App Store Connect/provisioning access. If the team does not permit automatic Xcode signing from an API key, use the manual Xcode signing route below.

The workflow picks a unique build number (`100 + GITHUB_RUN_NUMBER`) and uses `xcodebuild archive` plus `xcodebuild -exportArchive` with destination `upload`, method `app-store-connect` and the existing bundle/team identifiers. A green upload **only establishes Apple's acceptance of the binary**; the build must still be processed by App Store Connect and assigned to internal TestFlight testers.

## Manual Mac fallback

On a Mac with current Xcode and Apple team access:

```sh
git checkout feat/member-referral-vouches-testflight-nov17
npm ci
npm run build
npx cap sync ios
open ios/App/App.xcodeproj
```

Supply the same **public** production Supabase variables used by the release workflow during `npm run build`. In Xcode choose the `App` scheme, Team `926NTNU4M7`, then **Product → Archive**. In Organizer select **Distribute App → TestFlight & App Store** or **TestFlight Internal Only**. Confirm the archive uses the correct bundle id, bump the build number if Apple already has that number, and upload the build.

After Apple processes it, open [App Store Connect](https://appstoreconnect.apple.com) → ETHER by LCOVE → TestFlight and add the intended internal testers. They install via Apple's TestFlight app.

## Verification before promoting referral features to production

1. Apply migration `20261117060000_member_referrals_and_familcy_acceptance.sql` to **production** only after staging regression tests and release approval. It is already installed in **staging**.
2. Active user: Settings → Vouch for a Creative → copy/share the link.
3. Pending user: /pending → Bring a Creative with You → copy/share the link.
4. Invitee opens the link and registers with verified email. They still submit required creative review links and remain pending; referrals are never an access bypass.
5. Admin accepts the invitee. The applicant receives the in-app welcome and email, and the sponsor receives an in-app/email acceptance alert (retained even if sponsor remains pending). Repeat status edits must not duplicate notices.
6. Test native APNs push with a real opted-in admin iPhone. New-member admin pushes remain a separate feature and were not verified by this migration.

Never merge this candidate just to obtain a signed iPhone build; confirm the actual Apple build/upload first.
