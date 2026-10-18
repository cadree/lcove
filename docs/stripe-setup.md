# Stripe setup

Nothing in this file is a secret. Do not paste live keys, webhook signing secrets, or service-role keys into the repo, into chat, or into a migration.

The app does not call Stripe until these values exist as Supabase Edge Function secrets. The webhook is the only place a payment becomes a membership, donation, ticket, network subscription, or paid store order.

## Environment variables

Set these in the Supabase dashboard: Project Settings, Edge Functions, Secrets.

| Name | Where it comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe dashboard, Developers, API keys. Use the secret key (`sk_live_...` in production, `sk_test_...` on a test account). |
| `STRIPE_WEBHOOK_SECRET` | The signing secret for the endpoint below (`whsec_...`). This is not the API key. |
| `SUPABASE_URL` | Already provided by Supabase to every function. |
| `SUPABASE_ANON_KEY` | Already provided by Supabase to every function. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already provided by Supabase to every function. The webhook uses it to write payments. Never ship it in the client. |

`stripe-music-webhook` is the one webhook. `verify_jwt` is false in `supabase/config.toml` because Stripe does not send a Supabase JWT. The function rejects any request that does not carry a valid `Stripe-Signature` for `STRIPE_WEBHOOK_SECRET`. A handler failure returns a non-200 status so Stripe retries. A repeated event id is ignored after it is stored in `processed_stripe_events`.

## Endpoint

1. Apply `supabase/migrations/20261018201000_payments_webhook_store_fund.sql` on staging first. That creates `donations`, `processed_stripe_events`, and the order functions. Do not run it against production until staging looks right. Do not run it from this chat.
2. Deploy `supabase/functions/stripe-music-webhook` with the rest of `supabase/functions/`.
3. In the Stripe dashboard, Developers, Webhooks, Add endpoint.
4. Endpoint URL: `https://<project-ref>.supabase.co/functions/v1/stripe-music-webhook`
5. Listen to these events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
6. Open the endpoint, reveal the signing secret, and save it as `STRIPE_WEBHOOK_SECRET`.
7. Send a test event from the Stripe dashboard only after the secret is saved. Do not use the live account from a development machine.

`checkout.session.completed` records:

- membership (`metadata.type = membership`)
- fund donation (`metadata.type = fund_donation`) into `donations`
- network subscription (`metadata.network_id`)
- store card order (`metadata.type = store_order`): status becomes confirmed and inventory drops once
- event ticket (`metadata.type = event_ticket`): the ticket is confirmed once; `verify-event-purchase` uses the same database function
- exclusive track purchase and artist subscription, same as before

`checkout.session.expired` cancels a pending store order and deletes the platform-fee row that was written before payment. The store page does the same when the buyer returns with `?purchase=cancel`.

## Fees Cadre should confirm

These two numbers are the ones the code charges and the ones the screens show. They live in `src/lib/fees.ts` and `supabase/functions/_shared/fees.mjs` and must stay equal.

- Store sales made on Ether: **20%** application fee on the item price. The seller receives 80%. A seller-set flat shipping amount and a seller-entered tax line are added in full and are not part of the 20%. The seller sees this before they publish an item.
- Event tickets: **5%** application fee when the host has Stripe Connect payouts on. This matches the Finance tab. It was previously charged as 0% while the screen said 5%. **Confirm 5% before production.** If the host has not finished Connect, the charge is not split and the platform holds the payment.
- Shopify products linked from a public `/products.json` list are not sold on Ether. The buy button goes to `https://{shop}/products/{handle}`. Ether does not take a fee on those sales. The store settings screen says that.

Shipping addresses collected at card checkout are limited to the United States and Canada. Confirm that country list if sellers ship elsewhere.

## iOS

The iOS app does not open Stripe for memberships, donations, or store card checkout. Physical goods can show a text link to the Ether website. Donations are hidden, with no payment link, because Apple does not allow card donations inside the app. Credits already on the account can still be spent.
