

## Finish Remaining Guest Event Tasks

### Status Check
- Calendar save for non-members — **already done** (buttons exist in PublicEventPage)
- Guest donations — **already done** (UI + edge function working)
- **Wallet passes** — scaffolded, but requires external Apple/Google certificates you haven't set up yet. No more code to write until those are configured.
- **Push notifications for non-members** — needs implementation (below)

### Plan: Guest Push Notification Opt-In

Allow non-members to opt into browser push notifications for event updates without creating an account.

#### 1. Database: Guest push subscriptions table
Create a new `guest_push_subscriptions` table (no `user_id` FK required):
- `id`, `guest_email`, `event_id`, `endpoint`, `p256dh`, `auth`, `user_agent`, `created_at`, `updated_at`
- Unique constraint on `(guest_email, event_id, endpoint)`
- RLS: anon can INSERT; service_role can SELECT (for sending)

#### 2. PublicEventPage: Add "Get Notified" button
After successful RSVP or ticket purchase, show a "Get Event Reminders" button that:
- Requests browser notification permission
- Registers the service worker
- Subscribes to push via VAPID key
- Saves the subscription + guest email + event ID to `guest_push_subscriptions`
- No account needed — uses the guest email from the RSVP/ticket form

#### 3. Update `send-event-reminder` edge function
When a host sends reminders, also query `guest_push_subscriptions` for that event and send push notifications to guest subscribers (reusing the existing VAPID signing logic from `send-push-notification`).

#### 4. Update `send-push-notification` edge function
Add an optional `guest_subscriptions` path that accepts raw push subscription data instead of requiring a `user_id` lookup.

### Wallet Passes — Blocked on External Setup
The `generate-wallet-pass` edge function is ready. To activate it:
- **Apple Wallet**: Get a Pass Type ID certificate from Apple Developer, export it as base64, and add `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT`, `APPLE_PASS_KEY`, `APPLE_WWDR_CERT` as secrets
- **Google Wallet**: Enable the Google Wallet API, create an issuer ID and service account, then add `GOOGLE_WALLET_ISSUER_ID` and `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY` as secrets

No additional code changes needed — the edge function already handles both platforms once secrets are configured.

### Technical Details
- The guest push subscription flow reuses the existing `/sw.js` service worker and VAPID key (`VITE_VAPID_PUBLIC_KEY`)
- Guest subscriptions are stored separately from member subscriptions to avoid polluting the auth-gated `push_subscriptions` table
- The "Get Notified" UI only appears after a successful RSVP/ticket purchase (not before), since we need the guest's email

