
The user wants to add the `STRIPE_WEBHOOK_SECRET` so the `stripe-music-webhook` function can verify incoming Stripe events. This is a single-step action: request the secret via the secret tool. Once added, the webhook will start successfully validating signatures and unlocking purchases/subscriptions.

## Plan: Add STRIPE_WEBHOOK_SECRET

### What I'll do
Request the `STRIPE_WEBHOOK_SECRET` secret so the `stripe-music-webhook` edge function can verify that incoming events are genuinely from Stripe.

### What you need to do first (in Stripe Dashboard)
1. Go to **Stripe Dashboard → Developers → Webhooks → Add endpoint**
2. Endpoint URL:
   ```
   https://wjbyvlgsxscwukkolehg.supabase.co/functions/v1/stripe-music-webhook
   ```
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Click **Add endpoint**
5. On the new endpoint page, click **Reveal** under "Signing secret" and copy the value (starts with `whsec_...`)

### Then
I'll prompt you to paste that `whsec_...` value into the secret form. Once saved, the webhook will:
- Verify every Stripe event signature
- Mark `exclusive_track_purchases.payment_status = 'paid'` after successful checkout
- Insert/activate `artist_subscriptions` after successful subscription
- Track subscription lifecycle (renewal, cancellation)

### After secret is added — verification
1. As artist: Connect Payouts → onboard via Stripe Express
2. As different user: open artist's profile → click Buy → use test card `4242 4242 4242 4242` → return to profile
3. Confirm track shows "Unlocked" and Save / Add to Profile / Download buttons appear
4. Check Stripe Dashboard → Webhooks → confirm `200` response on the event
