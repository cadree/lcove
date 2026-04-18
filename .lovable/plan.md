

## Audit — Why purchase & subscribe are broken

### Root cause #1 (HARD BLOCKER): Wrong column name on artist Connect lookup
Both `purchase-exclusive-track` and `create-artist-subscription` edge functions read `profiles.connect_account_id` — **that column does not exist**. The actual column is `profiles.stripe_connect_account_id`. Every checkout immediately throws `"Artist has not set up payments yet"` even when the artist has onboarded. This is the single error blocking 100% of buys.

### Root cause #2: No music-specific Connect onboarding UI
Owners of music profiles have no place to connect payouts. The existing `useStoreConnect` hook is store-scoped (writes to `stores.stripe_connect_account_id`), not the profile. So even after fixing the column name, most artists have nothing to route to.

### Root cause #3: Purchase row inserted at checkout creation, not after payment
`purchase-exclusive-track` inserts into `exclusive_track_purchases` immediately. That means a buyer who closes the Stripe tab without paying still gets unlocked. Same for `artist_subscriptions`. We need a webhook to flip status only on `checkout.session.completed`.

### Root cause #4: No subscription rule exists
Test artist only has a `purchase` rule (`$5`). There's no Subscribe CTA shown because no `subscription` rule has been created. Owner has no easy way to create one — `AccessRuleEditor` exists but is hidden behind a "Rules" toggle and not obvious.

### Root cause #5: UI doesn't refresh after returning from Stripe
After Stripe redirects back with `?purchase=success`, nothing invalidates `exclusive-purchases`/`artist-subscriptions` queries. Even when the row is inserted, the buy button stays.

### Root cause #6: No inline error feedback
`handlePurchase` swallows errors with a generic `toast.error("Failed to start purchase")`. Buyer never sees the real reason ("Artist has not set up payouts").

### Root cause #7: Owner can see "Buy" on own track
`!isOwner` guard exists but `isOwner` resolves via `user?.id === artist_user_id`. Verified OK — but if a track is published with no payout account, visitors hit the dead end with no warning.

---

## Fix Plan

### A. Database (one migration)
- Add `stripe_subscription_id`, `stripe_customer_id`, `current_period_end`, `cancel_at_period_end` to `artist_subscriptions` (status updates need them).
- Add unique index on `artist_subscriptions(stripe_subscription_id)` for idempotent webhook.
- Add `stripe_session_id` to `exclusive_track_purchases` + unique index for idempotent webhook.
- Add `payment_status` column (`pending`/`paid`/`failed`) on `exclusive_track_purchases`, default `pending`.

### B. Edge functions

**Fix `purchase-exclusive-track`:**
- Change `connect_account_id` → `stripe_connect_account_id`.
- Also check `profiles.payout_enabled = true` before allowing checkout. Throw clear error: `"This artist has not enabled payouts yet."`
- Stop inserting the purchase row at checkout creation. Insert it as `pending` with `stripe_session_id`, OR defer entirely to webhook.
- Pass `application_fee_amount: 0` explicitly in `payment_intent_data` (100% to artist via `transfer_data.destination`).
- Pass `client_reference_id: user.id` for safer webhook lookup.

**Fix `create-artist-subscription`:**
- Same column fix.
- Same payout_enabled check.
- Same defer to webhook; do not insert `artist_subscriptions` row up front.
- Add `application_fee_percent: 0`.

**New `stripe-music-webhook` edge function** (config: `verify_jwt = false`):
- Verifies signature with `STRIPE_WEBHOOK_SECRET`.
- Handles `checkout.session.completed`:
  - If `metadata.type === 'exclusive_track_purchase'` → upsert `exclusive_track_purchases` (idempotent on `stripe_session_id`) with `payment_status='paid'`.
  - If `metadata.type === 'artist_subscription'` → upsert `artist_subscriptions` with `stripe_subscription_id`, `current_period_end`, `status='active'`.
- Handles `customer.subscription.updated`/`deleted` → update `artist_subscriptions.status`.
- Returns 200 always after processing to prevent Stripe retries on duplicates.
- Ask user to add `STRIPE_WEBHOOK_SECRET` secret + paste the function URL into Stripe Dashboard → Webhooks (events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).

**New `create-music-payout-account` + `check-music-payout-status` edge functions:**
- Mirrors `create-store-connect-account` but writes to `profiles.stripe_connect_account_id` / `profiles.payout_enabled`.
- Returns Stripe Express onboarding URL.

### C. Frontend

**`useExclusiveMusic.ts`:**
- `hasAccess(trackId)`: also check active `artist_subscriptions` for this artist when the track has a subscription rule.
- Filter purchases to only `payment_status='paid'`.
- Add query for subscriptions.

**New `useMusicPayouts.ts` hook:**
- `useMusicPayoutStatus()` — reads `profiles.stripe_connect_account_id` + `payout_enabled` for current user.
- `useCreateMusicPayoutAccount()` mutation — invokes `create-music-payout-account`.

**`ExclusiveMusicSection.tsx`:**
- If owner has any track with `price_cents > 0` OR a paid access rule but `payout_enabled !== true`, render an amber banner at the top:
  > "Connect payouts to start selling — Buyers can't purchase your tracks until you connect a payout account." [Connect Payouts] button.
- After Stripe redirect (`?purchase=success` or `?subscribed=true` on URL), invalidate purchases + subscriptions queries and toast success.
- `handlePurchase`: surface the real edge function error message (not generic).

**`ExclusiveTrackCard.tsx`:**
- If non-owner & no payout account on artist: disable Buy with tooltip "Artist hasn't enabled payouts yet" instead of dead-end checkout.
- Add Subscribe CTA when artist has any `subscription` rule (currently only shown when `purchaseRule` is absent — should show alongside).

**Inline owner UX for creating subscription rule:**
- Add a one-click "Enable monthly subscription ($X/mo)" preset in `AccessRuleEditor` so owners don't have to navigate the raw form.

### D. Console + visible errors
- Edge functions log structured `[MUSIC-PAYMENT]` lines for: missing payout, invalid rule, Stripe error, webhook signature failure.
- Frontend prints `[MusicPurchase]` breadcrumbs and shows the server's error message in a toast that stays 6s.

---

## Stripe model used (and why)

**Stripe Connect Express + Destination charges via `transfer_data.destination`** with `application_fee_amount: 0` (one-time) and `application_fee_percent: 0` (subscription).

- Platform creates the PaymentIntent and Subscription on the platform account.
- Funds settle to the artist's connected account automatically.
- Platform retains nothing (fee = 0).
- Platform handles disputes/refunds centrally if ever needed.
- Same pattern already used by `create-store-connect-account` — consistent.

This is the cleanest marketplace model when the platform wants central control of customer experience but zero revenue cut.

---

## Files

**New:**
- `supabase/migrations/<ts>_music_commerce_hardening.sql`
- `supabase/functions/stripe-music-webhook/index.ts` (+ config block `verify_jwt = false`)
- `supabase/functions/create-music-payout-account/index.ts`
- `supabase/functions/check-music-payout-status/index.ts`
- `src/hooks/useMusicPayouts.ts`

**Modified:**
- `supabase/functions/purchase-exclusive-track/index.ts` (column fix, defer insert, fee=0)
- `supabase/functions/create-artist-subscription/index.ts` (column fix, defer insert, fee=0)
- `src/hooks/useExclusiveMusic.ts` (subscription-aware access, paid filter)
- `src/components/music/ExclusiveMusicSection.tsx` (payout banner, refresh on return, real errors, subscribe CTA)
- `src/components/music/ExclusiveTrackCard.tsx` (subscribe button, payout-disabled state)
- `src/components/music/AccessRuleEditor.tsx` (subscription preset)
- `supabase/config.toml` (add `verify_jwt = false` for the webhook only)

**Secrets needed:** `STRIPE_WEBHOOK_SECRET` (will request after you approve).

---

## Verification I'll perform after build
1. As artist (owner): see amber banner → click Connect Payouts → complete Stripe Express onboarding → banner disappears.
2. Sign in as a different user → open artist profile → click Buy → Stripe checkout opens → use test card `4242 4242 4242 4242` → return to profile → track shows Unlocked → Save/Add to Profile/Download appear.
3. Same flow for Subscribe.
4. Confirm 100% routing in Stripe Dashboard → PaymentIntent shows `transfer_data.destination = acct_xxx` and `application_fee_amount = 0`.
5. Confirm DB: `exclusive_track_purchases.payment_status='paid'` only after webhook fires.

