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

The Capacitor app calls `@capacitor/push-notifications` only when `Capacitor.getPlatform() === 'ios'`. It stores the device token in `push_subscriptions` with `platform = 'apns'` and an `apns:` endpoint. The web sender skips those rows.

Sending to the device needs an APNs authentication key (`.p8`), the Key ID, and the Team ID from Cadre's Apple Developer account, plus the app's bundle id. That sender is not implemented here. Registration alone does not deliver a notification.
