# Push setup

Web push and iOS push are separate. Do not commit private keys.

## Web push (VAPID)

Generate a key pair on a trusted machine:

```bash
npx web-push generate-vapid-keys
```

That prints a public key and a private key. Store them as follows:

| Key | Where |
| --- | --- |
| Public | `VITE_VAPID_PUBLIC_KEY` in the app env (see `.env.example`) and the Supabase secret `VAPID_PUBLIC_KEY` |
| Private | Supabase secret `VAPID_PRIVATE_KEY` only |

Optional: `VAPID_SUBJECT` (`mailto:you@domain`) on the send-push-notification function. It defaults to `mailto:push@ether.local`.

`send-push-notification` turns that base64url pair into the JWK `@negrel/webpush` imports, signs the request (VAPID), and encrypts the body (aes128gcm). Browsers reject an unsigned or unencrypted payload.

The service worker subscribes with `VITE_VAPID_PUBLIC_KEY`. The same public key must be the one paired with `VAPID_PRIVATE_KEY`.

## iOS (APNs)

The Capacitor app calls `@capacitor/push-notifications` only when `Capacitor.getPlatform() === 'ios'`. It stores the device token in `push_subscriptions` with `platform = 'apns'` and an endpoint of `apns:<token>`.

`send-push-notification` delivers those rows through Apple's production APNs host `https://api.push.apple.com` (`/3/device/<token>`). The topic is the bundle id `app.lovable.e07d9c457fd949f78f3cc7d5998be668`. Each request uses `apns-push-type: alert` and `apns-priority: 10`. The body is an alert with the notification title and body, plus `url` and `type`. `url` is the same in-app path the service worker opens when a web notification is tapped (for example `/messages?chat=<id>`).

Signing reuses `signApnsJwt` in `supabase/functions/_shared/apns.mjs`. These Supabase secrets are the ones already used for Wallet passes. Do not commit the key.

| Secret | Role |
| --- | --- |
| `APPLE_APNS_KEY_P8` | APNs auth key (`.p8`) |
| `APPLE_APNS_KEY_ID` | Key ID for that `.p8` |
| `APPLE_TEAM_ID` | Team ID. This is the JWT `iss` claim. |

`ios/App/App/App.entitlements` sets `aps-environment` to `production` and still has `com.apple.developer.associated-domains` (`applinks:etherbylcove.com`). iOS only issues a push token from a build signed with that entitlement. The App ID also needs the Push Notifications capability in the Apple Developer portal.

A response of `410`, `BadDeviceToken`, or `Unregistered` deletes that `push_subscriptions` row. A row whose endpoint is not a hex token after the `apns:` prefix is deleted as invalid. Other failures are logged with the HTTP status and Apple's reason code. Device tokens and private keys are not written to the logs.

Web push above is unchanged. A real iPhone build is required before a banner can be confirmed on a device. The payload shape and the 410 / invalid-token decision are covered by unit tests and do not call Apple.
