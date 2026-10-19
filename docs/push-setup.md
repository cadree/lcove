# Push setup

Web push and iOS push are separate. Neither works until Cadre supplies the keys below. Do not commit private keys.

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

The Capacitor app calls `@capacitor/push-notifications` only when `Capacitor.getPlatform() === 'ios'`. Turning push on in Settings asks for permission and stores the device token in `push_subscriptions` with `platform = 'apns'` and an `apns:` endpoint. A later launch refreshes the token if permission is already granted. The app does not prompt on launch. The web sender skips those rows.

Sending to the device is not implemented. Registration does not need the key, and neither does the Xcode build.

The owner creates the key in the Apple Developer account. Do not commit it.

1. Identifiers: register App ID `com.etherbylcove.app` with Push Notifications.
2. Keys: create a key with Apple Push Notifications service (APNs) enabled. Download the `.p8` once. Apple does not offer a second download.
3. Save three values with the `.p8`: the Key ID shown on that key, the Team ID (Membership details, 10 characters), and the bundle id `com.etherbylcove.app`.
4. A sender that talks to APNs uses those three values plus the `.p8`. `send-push-notification` does not do that yet.
