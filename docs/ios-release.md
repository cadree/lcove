# Ether iOS release

Bundle id: `com.etherbylcove.app`

Display name: Ether

Version: 1.0 (`MARKETING_VERSION`). Build: 1 (`CURRENT_PROJECT_VERSION`). Raise the build number in Xcode before every upload.

The iOS project is already in `ios/` (Capacitor 8, Swift Package Manager). There is no CocoaPods step.

Supabase project: `aykopqinnnssxdhxqruo`. The web build the app talks to is `https://ether-staging.pages.dev` until cutover, then `https://etherbylcove.com`. The native shell bundles the Vite output. It does not load a remote `server.url`.

This Linux checkout cannot run `xcodebuild` or the iOS Simulator. Signing, archive, and TestFlight happen on a Mac.

## On the Mac

1. Install Xcode from the Mac App Store and open it once so it installs the extra components.
2. Clone this branch. Copy `.env.example` to `.env` and set the public Supabase values for project `aykopqinnnssxdhxqruo` before the production build. Vite inlines them into the native bundle. An empty `.env` produces an app that cannot sign in.

```
VITE_SUPABASE_URL=https://aykopqinnnssxdhxqruo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from Project Settings → API Keys>
VITE_SUPABASE_PROJECT_ID=aykopqinnnssxdhxqruo
```

The anon key is public. Do not put the service role key in `.env`.

```bash
npm ci
npm run build
npx cap sync ios
```

3. Open the project:

```bash
open ios/App/App.xcodeproj
```

`npx cap open ios` does the same thing. Xcode resolves the local Swift package `ios/App/CapApp-SPM`. Wait until package resolution finishes.

4. Select the **App** target, then **Signing & Capabilities**. Set **Team** to the Apple Developer team that will ship Ether. Automatic signing is already on. The bundle id must stay `com.etherbylcove.app`.
5. Confirm the same target shows Push Notifications and Associated Domains. Those come from `ios/App/App/App.entitlements`. A paid Apple Developer membership is required. A free personal team cannot ship to TestFlight.
6. Choose **Any iOS Device (arm64)** as the run destination. Product → Archive.
7. In the Organizer, **Distribute App** → **App Store Connect** → **Upload**.
8. In App Store Connect, wait until the build finishes processing, then attach it to TestFlight.

Run `npm run build` and `npx cap sync ios` again after every web change before you archive. `ios/App/App/public` and `ios/App/App/capacitor.config.json` are gitignored. The archive only contains the web bundle from the last sync.

Do not set `server.url` in `capacitor.config.ts`. That loads a dev server instead of `dist`.

## What the iOS app shows for payments

`IOS_DONATIONS_ENABLED` in `src/lib/iosCheckout.ts` is `false`. `allowsStripeCheckout` is the rule:

| Surface | iOS build |
| --- | --- |
| Membership ($5/month and up, Elite $25/month) | Join, price picker, and Stripe billing portal are hidden. People who already subscribed on the web still see an active membership. No link to buy on the web. |
| Exclusive music and artist subscriptions | Buy and Subscribe are hidden. The purchase functions return before calling Stripe. |
| Cinema and network subscriptions | Subscribe is hidden. Catalog price badges are hidden. Playback of content the account already has still works. |
| Live-stream tips (LC) | The Tip LC control is hidden. LC can be paid out, so a tip inside a stream is a digital payment. |
| Donations | Donate buttons are hidden. The screen says donations are not available in the iOS app and does not link to checkout. |
| Event tickets | Stripe checkout stays. A ticket to a real-world event is a good or service used outside the app (guideline 3.1.3(e)). |
| Store products | In-app card checkout is hidden. A physical product can link to `https://etherbylcove.com/store`. LC credit spend still works. |
| Store services | In-app card checkout is hidden, with no website purchase link. A "service" is not clearly consumed outside the app. |
| Studio rentals and studio bookings | Stripe stays. Renting a room or booking a studio is a real-world service. Peerspace and Shopify links stay, because those checkouts are also outside the app. |

### Trade-off

Hiding Stripe for memberships, music, cinema, tips, and donations is the setup that can pass review worldwide without an extra Apple entitlement. People cannot buy those digital goods in the iOS app. They can buy them on the website, and the app will show access they already have.

A "buy on the web" button for a digital membership is the US anti-steering option. It still needs Apple's external-purchase entitlement (or the US storefront rules), the disclosure sheet, and it does not cover the rest of the world. That path is not implemented.

To show card donations again, set `IOS_DONATIONS_ENABLED` to `true` only after Apple has accepted a nonprofit donation exception. Membership and the other digital goods stay hidden either way.

## Account deletion, report, and block

Guideline 5.1.1(v): Settings → **Delete my account** is in the same web bundle the native shell loads. It calls the `delete-account` function with the signed-in session. There is no iOS-only branch that hides it. The button is at `/settings`, which requires a signed-in user.

Deletion is refused, and the dialog stays open with the reason, when any of these are true: a payout is pending or processing, earned LC balance is above zero, money is held, Stripe Connect still has a balance, or a Stripe subscription is still billing. The reviewer's deletion account must be empty of those.

Guideline 1.2: Report is on a post, profile, comment, message, project, and live chat. Block is on a profile and in a direct message. Settings lists blocked people and can unblock them. Sign in with Apple is not required. Auth is email and password only. There is no Google, Facebook, or other third-party login.

## Permissions and privacy

`ios/App/App/Info.plist` purpose strings:

| Key | Why |
| --- | --- |
| `NSCameraUsageDescription` | Live video, and the event check-in QR scanner |
| `NSMicrophoneUsageDescription` | Live-stream audio |
| `NSPhotoLibraryUsageDescription` | Choosing an existing photo for a profile, post, event, message, or other upload |

The app does not request location, contacts, tracking, or saving into the photo library. The city on a profile is typed by the person. There is no Core Location prompt. Notifications have no purpose-string key. `UIBackgroundModes` includes `remote-notification`.

`ITSAppUsesNonExemptEncryption` is `false`. The app uses HTTPS only.

`ios/App/App/PrivacyInfo.xcprivacy` is in the app target. Tracking is off. Collected data matches the in-app policy at `/privacy`: name, email, phone, the profile city (coarse location, not GPS), photos and video, live audio, user id, the APNs device token, purchase history, posts and messages, and product interaction.

## Links

Auth returns through the custom scheme `com.etherbylcove.app`, registered in Info.plist.

Add these on Supabase project `aykopqinnnssxdhxqruo`, Authentication → URL configuration → Redirect URLs:

- `com.etherbylcove.app://**`
- `https://ether-staging.pages.dev/**`
- `https://etherbylcove.com/**`

The app sends `com.etherbylcove.app://auth?confirmed=1` and `com.etherbylcove.app://auth?reset=true`.

Universal links are enabled for `applinks:etherbylcove.com` and `applinks:www.etherbylcove.com`. They do nothing until this file is hosted at `https://etherbylcove.com/.well-known/apple-app-site-association` (no file extension, `Content-Type: application/json`):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.etherbylcove.app",
        "paths": ["*"]
      }
    ]
  }
}
```

Replace `TEAMID` with the 10-character Team ID. Until that file is live, https links open the website. The custom scheme still returns auth into the app. Do not publish a file that still says `TEAMID`.

## Push

Registration is in the app. It does not send notifications, and the build does not need the APNs key.

1. On a signed-in iPhone, Settings → Push Notifications asks for permission and stores the device token in `push_subscriptions` (`platform = apns`, endpoint `apns:<token>`).
2. If permission was already granted, the next launch refreshes that token. The app does not prompt on launch.
3. `send-push-notification` skips `apns` rows. Web push is separate. See `docs/push-setup.md`.

Create the key in the Apple Developer account (Certificates, Identifiers & Profiles → Keys):

1. Register the App ID `com.etherbylcove.app` with Push Notifications and Associated Domains.
2. Create a key, enable Apple Push Notifications service (APNs), and download the `.p8` once. Apple will not offer that file again.
3. Record the Key ID, the Team ID, and the bundle id `com.etherbylcove.app`.
4. Keep the `.p8` in a secret store. Do not commit it.

`aps-environment` in the entitlements file is `development`. Xcode's automatic signing uses `production` for an App Store archive.

## Icons and splash

Source artwork: `src/assets/ether-bear-logo.png` (the same file as `src/assets/lc-bear-logo.png`). It is the portrait bear already used on the sign-in screen, 1275×1650, on black.

`assets/icon.png` is that bear letterboxed on `#080808` at 1024×1024, flattened so the App Store icon has no alpha. `assets/splash.png` and `assets/splash-dark.png` are the same treatment at 2732×2732.

Xcode's current icon catalog uses one 1024×1024 image (`AppIcon-512@2x.png`). The splash imageset has the 1x, 2x, and 3x universal images, including dark. `@capacitor/assets` writes those from `assets/icon.png` and `assets/splash.png`.

## App Store Connect

Create the app record with bundle id `com.etherbylcove.app` after the App ID exists.

- Name: Ether
- Subtitle, promotional text, description, keywords, and category. Social Networking is the closest fit.
- Support URL: `https://etherbylcove.com/support` (public page, no login). Until the domain is cut over, the same route is on `https://ether-staging.pages.dev/support`. App Store Connect needs the URL that stays up after release. Use the production URL once it serves the page.
- Privacy policy URL: `https://etherbylcove.com/privacy`
- Marketing URL: `https://etherbylcove.com`
- Copyright and a contact email (`privacy@ethercreative.co` is the address in the privacy policy)
- Age rating: answer the questionnaire for user-generated content, messaging, and unrestricted web content. Do not claim the app is made for kids.
- Export compliance: already declared with `ITSAppUsesNonExemptEncryption = false`.
- App Privacy nutrition labels, collected and linked to the user, not used for tracking:
  - Contact info: name, email, phone
  - Location: coarse (the city someone types on their profile, not GPS)
  - User content: photos, video, audio (live streams), other user content (posts, comments, messages)
  - Identifiers: user id, device id (APNs token)
  - Purchases: purchase history
  - Usage data: product interaction
  - Do not declare card numbers. Stripe processes cards. Do not declare precise location, contacts, or tracking.
- Screenshots. The target includes iPhone and iPad (`TARGETED_DEVICE_FAMILY = 1,2`), deployment target iOS 15.
  - iPhone 6.9-inch: 1320 × 2868 or 1290 × 2796
  - iPhone 6.5-inch: 1284 × 2778 or 1242 × 2688, if Connect still asks
  - iPad 13-inch: 2064 × 2752 or 2048 × 2732
  Capture on the simulator after `npx cap sync ios`.
- Reviewer account. Put the username and password in App Review Information.
  - One account that can sign in, open Settings, and delete itself: no pending payout, earned LC balance of 0, no held money, no Stripe Connect balance, no active Stripe subscription.
  - One account that already has membership or cinema access, if you want review to see paid content. The iOS app cannot sell that access.
  - Say in the notes that digital memberships, donations, music purchases, and stream tips are not sold in the iOS app, and that event tickets and studio bookings are for real-world events.

## TestFlight

1. Upload the archive and wait for processing.
2. Internal testers are App Store Connect users on the team.
3. External testers need a group and Beta App Review.
4. On a device, check: email sign-in returns through `com.etherbylcove.app`, Settings shows Delete my account, Report and Block are reachable, camera and microphone prompts appear on a live stream, a photo pick explains why, membership has no Join button, donate is absent, and a locked cinema title has no Subscribe button.

## After a web-only change

```bash
npm ci
npm run build
npx cap sync ios
```

Then archive again. Bump `CURRENT_PROJECT_VERSION` before the upload.
