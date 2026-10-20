# Ether iOS release checklist

This is the work that can be done without a paid Apple Developer account. Signing, push, TestFlight, and App Store upload need a Mac with Xcode and a paid account ($99/year). Nothing in this file asks anyone to buy that account.

Bundle id: `app.lovable.e07d9c457fd949f78f3cc7d5998be668` (`src/config/nativeIds.ts`). This is the existing App Store Connect app **ETHER by LCOVE**, Apple ID 6758372010, team 926NTNU4M7. Do not register a new app or change the bundle id. Marketing version is 1.0.1 and the build number is 2, because 1.0 (1) is already uploaded.

App name on the home screen: `Ether`.

## Proof on Linux

These ran on Linux, without a Mac and without an Apple Developer account:

- `npx tsc -p tsconfig.app.json --noEmit` — passed
- `npm run build` — passed (Vite production build)
- `npx cap add ios` — wrote the Xcode project. Capacitor 8 used the Swift Package Manager template. CocoaPods was not required, and `pod install` did not run.
- `npx capacitor-assets generate --ios` — wrote the 1024 icon and the 2732 splash images from the letterboxed logo
- `npx cap sync` — copied `dist` into the iOS app and refreshed `Package.swift`. Finished in under a second. No `server` block in the generated `ios/App/App/capacitor.config.json`.

`ios/App/App/public` and `ios/App/App/capacitor.config.json` are gitignored by the Capacitor template, so the sync output is not in git. Run `npx cap sync` again on the Mac after checkout.

## What is already in the repo

- [x] `capacitor.config.ts` uses app name `Ether` and the existing App Store bundle id.
- [x] `android.allowMixedContent` is removed. There is no Android project in this repo.
- [x] No `server.url`. A `server.url` would load a dev site instead of the bundled `dist` files. Leave it unset for TestFlight and the App Store.
- [x] `server.iosScheme` is unset. The WebView stays on the default `capacitor://localhost` origin so live streaming can call `getUserMedia`.
- [x] `ios.scheme` is unset. In Capacitor 8 that key is the Xcode build scheme (default `App`), not a URL scheme. The old value was the Lovable app id and would make `xcodebuild` look for a scheme that does not exist.
- [x] Auth return links use `app.lovable.e07d9c457fd949f78f3cc7d5998be668://...` from `getAuthRedirectUrl` in `src/lib/capacitorStorage.ts`. The same scheme is in `ios/App/App/Info.plist` under `CFBundleURLTypes`.
- [x] iOS project generated with `npx cap add ios` (Capacitor 8 default is Swift Package Manager, so CocoaPods is not required).
- [x] The iOS app icon stays the bear head: `src/assets/lc-bear-logo.png` on black. The launch splash is the ETHER wordmark centered on `#08080A`.
- [x] Stripe checkout for membership, exclusive music, artist subscriptions, and cinema or network subscriptions is hidden when `Capacitor.getPlatform() === "ios"`. Donations are off on iOS because `IOS_DONATIONS_ENABLED` is false. There are no in-app purchases.

## Digital goods (implemented)

Membership ($5/month and up, Elite $25/month), exclusive-track purchases, artist subscriptions, and cinema/network subscriptions are digital goods sold through Stripe. On iOS those purchase buttons are hidden, and the functions that start checkout refuse to run:

- Membership: `src/pages/Membership.tsx`, the Become a Member path on `src/pages/FundDashboard.tsx`, and the onboarding membership card. `startCheckout` and `openCustomerPortal` in `src/hooks/useMembership.ts` return early on iOS. The Stripe billing portal is hidden too, because it is a link out to manage a digital subscription.
- Exclusive music and artist subscriptions: Buy / Subscribe on `src/components/music/ExclusiveTrackCard.tsx`. `handlePurchase` in `src/components/music/ExclusiveMusicSection.tsx` returns early on iOS.
- Cinema networks: Subscribe on `src/pages/NetworkPage.tsx`, Subscribe Now in `src/components/cinema/VideoPlayer.tsx`, and the "Subscribe to Watch" label in `src/components/cinema/ContentDetailDialog.tsx`. `useSubscribeToNetwork` throws on iOS. Catalog price badges on `src/pages/Cinema.tsx` are hidden on iOS.

There is no "buy on the web" button. An external purchase link needs Apple's approval (External Link Account entitlement, or the US storefront external-purchase entitlement) and the paid account. Hiding the buttons is the safe state until Cadre has that approval.

People who already subscribed on the web can still open content they have access to. The iOS app does not sell a new subscription.

### Community Fund donations

Donations are off in the iOS app. `IOS_DONATIONS_ENABLED` in `src/lib/platform.ts` is `false`. `DonateDialog` and the fund page both read that flag, so Donate Now and Extra Donation are replaced by the iOS notice. Web and Android still show them. Membership and exclusive music stay hidden either way. This build does not add StoreKit or any in-app purchase.

### Payments this build does not hide

These are still in the iOS build:

- Live-stream tips (`Tip LC` in `src/components/streaming/StreamViewer.tsx`, `tip-stream`). This is a digital purchase inside the app.
- Community Fund donations. These are hidden on iOS while `IOS_DONATIONS_ENABLED` is false.
- Event tickets (`purchase-event-ticket`). Real-world tickets are often outside in-app purchase rules. Confirm the events are in-person.
- Store items (`purchase-store-item`). Card checkout is hidden on iOS. Physical goods can show a text link to the website. Credits still spend. Confirm each item is a physical good or a real-world service. Digital goods in the store would have the same problem as membership.
- Studio bookings (`purchase-studio-booking`). Treat as a real-world booking unless a booking is only access to digital content.

## Lovable sync and native login

`src/integrations/supabase/client.ts` is marked as generated. The Capacitor storage adapter used to be wired inside that file, so a Lovable regen would put sessions back on `localStorage` and native login would not survive an app restart.

The adapter implementation was already in `src/lib/capacitorStorage.ts`. The client construction now lives in `src/lib/supabaseClient.ts` (not a generated path). Two things point the old import at that file:

- `vite.config.ts` aliases `@/integrations/supabase/client` to `src/lib/supabaseClient.ts`.
- `tsconfig.json` and `tsconfig.app.json` use the same path.

`client.ts` itself only re-exports `supabaseClient`. If Lovable overwrites `client.ts` and leaves the alias in place, native login still uses Preferences. If Lovable also rewrites `vite.config.ts` or the `paths` entries, the alias is gone and a regenerated `client.ts` will not use the adapter. After every Lovable sync, check those three files and `capacitor.config.ts` (Lovable has previously put back `app.lovable.*` and a `server.url`).

Supabase Auth redirect allow-list must include `app.lovable.e07d9c457fd949f78f3cc7d5998be668://` (and the reset/confirm paths the app already uses). Until that allow-list is updated, email confirmation and password reset from the iOS app will not return into the app.

## Info.plist purpose strings

| Key | Why Ether asks |
| --- | --- |
| `NSCameraUsageDescription` | Live streams, and the event check-in QR scanner |
| `NSMicrophoneUsageDescription` | Audio during a live stream |
| `NSPhotoLibraryUsageDescription` | Choosing a photo for a profile, post, event, message, or other upload |
| Notifications | iOS has no purpose-string key for notifications. The system dialog has no custom sentence. Ether asks so it can deliver messages, event reminders, and community alerts. `UIBackgroundModes` includes `remote-notification`. Delivery still needs APNs (paid account). |

`NSPhotoLibraryAddUsageDescription` is not set. The app picks existing photos. It does not save into the photo library.

## Icon and splash

App icon artwork: `src/assets/lc-bear-logo.png` (the LC bear). It is portrait, 1275×1650, and sits on black. `assets/icon.png` (1024×1024) is that bear. The iOS app icon was not changed.

Splash artwork: `src/assets/ether-wordmark.png`, the neon ETHER wordmark with the black keyed out. `assets/splash.png` and `assets/splash-dark.png` (2732×2732) center that mark on `#08080A`. That square is the first frame of the web power-on. `#08080A` is the splash `backgroundColor` in `capacitor.config.ts`. The spinner is off so the native frame matches the web frame.

`@capacitor/assets` then wrote the iOS sizes into `ios/App/App/Assets.xcassets`.

## Needs a Mac and Xcode

These commands and clicks do not work on this Linux machine:

1. Install Xcode (App Store on the Mac) and open `ios/App/App.xcodeproj`. Capacitor 8 uses Swift Package Manager (`ios/App/CapApp-SPM`). Xcode resolves the packages. There is no `pod install` step.
2. The App target already uses `PRODUCT_BUNDLE_IDENTIFIER = app.lovable.e07d9c457fd949f78f3cc7d5998be668`, marketing version 1.0.1, and build 2. Upload that build to the existing app. Do not create a new App Store Connect record.
3. The target team is `926NTNU4M7`. Select that team when signing. Free personal teams cannot ship to TestFlight or the App Store, and they cannot use Push Notifications, Associated Domains, or Sign in with Apple.
4. Archive (Product → Archive) and upload with the Organizer or `xcodebuild -scheme App`. `npx cap open ios` also needs the Mac.
5. Retest magic links, email confirmation, and password reset against `app.lovable.e07d9c457fd949f78f3cc7d5998be668://`.

`npx cap sync ios` copies `dist` into `ios/App/App/public` and refreshes `ios/App/App/capacitor.config.json` plus `ios/App/CapApp-SPM/Package.swift`. The Capacitor template gitignores `public` and `capacitor.config.json`, so they are not in git. Run sync on the Mac after checkout, and again after any web build, so the archive contains the latest UI and the confirmed bundle id.

## Needs the paid Apple Developer account

- The App ID `app.lovable.e07d9c457fd949f78f3cc7d5998be668` is already registered for team 926NTNU4M7. Do not create another.
- Distribution certificate and provisioning profile (Xcode managed signing does this once the team is paid).
- Push Notifications capability and an APNs Auth Key (.p8) in Apple Developer, then the key in the push provider. The plugin is already a dependency (`@capacitor/push-notifications`). The plist background mode does not deliver pushes by itself.
- Associated Domains, only if universal links are required (`applinks:etherbylcove.com`). The project has no associated-domains entitlement and no `apple-app-site-association` file. Custom-scheme auth (`app.lovable.e07d9c457fd949f78f3cc7d5998be668://`) does not need them. Add associated domains when password autofill or https links should open the app.
- Sign in with Apple, **only if** a social login (Google, Facebook, and similar) is added. Email and password in `src/pages/Auth.tsx` do not require it. Do not add the button until a third-party login exists.
- The App Store Connect record already exists (Apple ID 6758372010). Screenshots and TestFlight still need a Mac upload of version 1.0.1 (2).
- Any external-purchase entitlement, if Cadre later wants a link to the website instead of hiding the buttons.

## Account deletion, report, and block

Apple requires apps that create accounts to offer account deletion inside the app (guideline 5.1.1(v)). Apps with user-generated content also need a way to report and block people (guideline 1.2).

This branch can block someone from a chat (`src/components/messages/ChatView.tsx`) and lists blocked people in Settings. It does not contain account deletion or a report flow. Those are expected from another PR. Do not submit until that PR is merged and the deletion path works on iOS.

## Privacy policy

The in-app policy is the public route `/privacy` (`src/pages/Privacy.tsx`). Logged-out visitors can open it (`AccessGate` treats `/privacy` as public).

App Store Connect needs an https URL. Use `https://etherbylcove.com/privacy` after confirming the live site serves that route without a login wall. The page asks people to contact `privacy@ethercreative.co`.

## App Store Connect metadata

Upload to the existing app. Do not create a second record.

- App Store Connect: ETHER by LCOVE, Apple ID 6758372010, bundle id `app.lovable.e07d9c457fd949f78f3cc7d5998be668`, team 926NTNU4M7
- Version 1.0.1 (2). 1.0 (1) is already on the app.
- Home screen name: Ether
- Subtitle, promotional text, description, keywords, support URL, marketing URL
- Privacy policy URL: `https://etherbylcove.com/privacy`
- Category: Social Networking is the closest fit. Confirm with Cadre.
- Age rating questionnaire (user-generated content, messaging)
- App Privacy nutrition labels, matching `src/pages/Privacy.tsx` (account data, photos, camera, microphone, purchases, identifiers)
- Copyright and a support contact
- Sign-in details for review. If membership content is behind a subscription bought on the web, give review a working account that already has access, and explain that iOS does not sell those digital goods.
- Screenshots. Apple currently requires the 6.9-inch iPhone set (1320 × 2868) and will scale older sizes. Capture on the iPhone simulator in Xcode. The Xcode project currently sets `TARGETED_DEVICE_FAMILY = "1,2"` (iPhone and iPad) and `IPHONEOS_DEPLOYMENT_TARGET = 15.0`, so App Store Connect will also ask for a 13-inch iPad set unless Cadre changes the target to iPhone only before upload.
- Export compliance: the app uses HTTPS. Answer the encryption question on the first upload. Do not set `ITSAppUsesNonExemptEncryption` until Cadre confirms there is no other encryption.

## TestFlight

1. Paid account, Mac, Xcode archive uploaded to App Store Connect.
2. Wait for processing.
3. Internal testers can install from the App Store Connect users on the team without a full Beta App Review.
4. External testers need a group and a short Beta App Review.
5. Install the build, then check: email sign-in and the return link, camera and microphone on a live stream, photo pick on a post, a locked cinema title shows no Subscribe button, membership shows no Join button, and an exclusive track shows no Buy button.

## After a Lovable sync

- [ ] `capacitor.config.ts` still has `Ether`, `app.lovable.e07d9c457fd949f78f3cc7d5998be668`, no `server.url`, no `android.allowMixedContent`.
- [ ] `vite.config.ts` still aliases `@/integrations/supabase/client` to `src/lib/supabaseClient.ts`.
- [ ] `tsconfig.app.json` still has the same path.
- [ ] `src/lib/supabaseClient.ts` still passes `capacitorStorage` when `Capacitor.isNativePlatform()` is true.
- [ ] Run `npx tsc -p tsconfig.app.json --noEmit`, `npm run build`, and `npx cap sync ios`.
