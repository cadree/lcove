# Stripe setup

Nothing in this file is a secret. Do not paste live keys, webhook signing secrets, or service-role keys into the repo, into chat, or into a migration.

The app does not call Stripe until these values exist as Supabase Edge Function secrets. The webhook is the only place a payment becomes a membership, donation, ticket, network subscription, or paid store order.

## Environment variables

Set these in the Supabase dashboard: Project Settings, Edge Functions, Secrets.

| Name | Where it comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe dashboard, Developers, API keys. Use the secret key (`sk_live_...` in production, `sk_test_...` on a test account). |
| `STRIPE_WEBHOOK_SECRET` | The signing secret for the endpoint below (`whsec_...`). This is not the API key. |
| `STRIPE_PRODUCT_COMMUNITY` | Community product id (`prod_...`) on this Stripe account. See Membership products below. |
| `STRIPE_PRICE_COMMUNITY` | A monthly price id (`price_...`) on that Community product. |
| `STRIPE_PRODUCT_ELITE` | Elite product id (`prod_...`) on this Stripe account. |
| `STRIPE_PRICE_ELITE` | Elite price id (`price_...`), $25 every month. |
| `SUPABASE_URL` | Already provided by Supabase to every function. |
| `SUPABASE_ANON_KEY` | Already provided by Supabase to every function. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already provided by Supabase to every function. The webhook uses it to write payments. Never ship it in the client. |

`stripe-music-webhook` is the one webhook. `verify_jwt` is false in `supabase/config.toml` because Stripe does not send a Supabase JWT. The function rejects any request that does not carry a valid `Stripe-Signature` for `STRIPE_WEBHOOK_SECRET`. A handler failure returns a non-200 status so Stripe retries. A repeated event id is ignored after it is stored in `processed_stripe_events`.

## Membership products

Create these in the Stripe account this project uses. Use test mode until launch. The ids are not in the repo. Checkout, the billing portal, and product-id tier mapping read them from function secrets and do not fall back to an id from another Stripe account.

| Secret | What to create |
| --- | --- |
| `STRIPE_PRODUCT_COMMUNITY` | Product named Community Member. This is the pay-what-you-want donation tier. Checkout charges a monthly amount the member chooses. The minimum is $5 (500 cents). |
| `STRIPE_PRICE_COMMUNITY` | A monthly recurring price on that Community product. Checkout does not charge this fixed price. It uses the product with the chosen amount. The price id is still required so the catalog is complete. |
| `STRIPE_PRODUCT_ELITE` | Product named Elite Member. |
| `STRIPE_PRICE_ELITE` | Monthly recurring price of $25 (2500 cents) on the Elite product. Checkout charges this price. |

1. In Stripe, open **Product catalog**, then **Add product**.
2. Community: recurring, monthly. Copy the product id and the price id.
3. Elite: recurring, $25 per month. Copy the product id and the price id.
4. On GitHub, **Settings**, **Secrets and variables**, **Actions**, add the four names. Do not paste the ids into git or chat.
5. Re-run **Deploy Supabase functions** so the workflow copies them. The click path is in `docs/deploy-ether-prod.md`.

If any name is unset, membership checkout, the customer portal, and a subscription that has to be recognized by product id fail with `membership not configured: missing` and the missing name. A subscription that already carries `metadata.tier` of `community` or `elite` still maps from that metadata.

## Endpoint

1. Apply `supabase/bundle/ether-schema.sql` on the new project `aykopqinnnssxdhxqruo`. That file includes `20261018201000_payments_webhook_store_fund.sql`, which creates `donations`, `processed_stripe_events`, and the order functions. Do not run it against the paused ETHER project or the Lovable database.
2. Deploy `supabase/functions/stripe-music-webhook` with the rest of `supabase/functions/`.
3. In the Stripe dashboard, Developers, Webhooks, Add endpoint.
4. Endpoint URL: `https://aykopqinnnssxdhxqruo.supabase.co/functions/v1/stripe-music-webhook`
5. Listen to these events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
6. Open the endpoint, reveal the signing secret, and save it as the GitHub Actions secret `STRIPE_WEBHOOK_SECRET`. Run the "Deploy Supabase functions" workflow so it is copied onto the project. The click path is in `docs/deploy-ether-prod.md`. Do not paste the secret into git or chat.
7. Send a test event from the Stripe dashboard only after the secret is saved. Do not use the live account from a development machine.

`checkout.session.completed` records:

- membership (`metadata.type = membership`)
- fund donation (`metadata.type = fund_donation`) into `donations`
- network subscription (`metadata.network_id`). The community-fund fee is written to `community_fund_fees`
- studio booking (`metadata.type = studio_booking`). The booking is marked completed and the community-fund fee is written to `community_fund_fees`
- store card order (`metadata.type = store_order`): status becomes confirmed and inventory drops once
- event ticket (`metadata.type = event_ticket`): the ticket is confirmed once; `verify-event-purchase` uses the same database function
- exclusive track purchase and artist subscription, same as before

`invoice.paid` records the community-fund fee for a later network-subscription invoice. The first invoice is also recorded from `checkout.session.completed`. Both writes use the Stripe invoice id, so the first payment is stored once. Membership, donation, and artist invoices are ignored.

`checkout.session.expired` cancels a pending store order and deletes the platform-fee row that was written before payment. The store page does the same when the buyer returns with `?purchase=cancel`.

`charge.refunded` for a membership invoice reduces `memberships.lifetime_contribution` by the refunded amount, never below 0, sets `memberships.status` to `cancelled`, and cancels the Stripe subscription immediately. The membership row stays. A later `customer.subscription.deleted` for that subscription does not write the membership again. The same event still refunds a store order, donation, or ticket when the payment intent matches one.

## Fees

These numbers are what the code charges and what the screens say. They live in `src/lib/fees.ts` and `supabase/functions/_shared/fees.mjs` and must stay equal. Credit sales use the same store rate inside `complete_store_credit_purchase`.

- Store sales through Ether checkout: **10%** of the item price (`STORE_PLATFORM_FEE_PERCENT`). The seller receives 90%. The seller-entered shipping amount and the seller-entered tax line are added in full and are not part of the 10%. The seller sees this before they publish an item. This is not the community-fund fee.
- Shopify products linked from a public `/products.json` list are not sold on Ether. The buy button goes to `https://{shop}/products/{handle}`. Ether does not take a fee on those sales.
- Event tickets: **no platform fee** (`EVENT_PLATFORM_FEE_PERCENT` is 0). Checkout does not send `application_fee_amount`. The Finance tab and payout settings say that, and they do not show a fee line. When the host has Connect payouts on, the charge is transferred without a platform cut. When Connect is off, the platform still receives the charge until payouts are set up. That is not a fee.
- Network subscriptions: **10%** (`COMMUNITY_FUND_FEE_PERCENT`), earmarked for the community fund. When the creator has Connect payouts on, Checkout sends `application_fee_percent` of 10. The creator receives 90%. The fee is inserted into `community_fund_fees` when the payment completes, and `membership_fund_snapshot` adds that dollar amount to the fund total.
- Studio bookings on Ether checkout: **10%** of the booking price (`COMMUNITY_FUND_FEE_PERCENT`), earmarked for the community fund. Checkout sends `application_fee_amount`. The fee row is written on `checkout.session.completed`, not when the Checkout Session is created. A credit booking records the same percentage as `credits_amount` when the credit payment completes. Credit amounts are not added to the dollar fund total.

## Shipping and tax

Sellers arrange their own shipping. Checkout adds the amount the seller entered as a line named "Shipping (seller arranges)". Ether does not collect a shipping address and does not limit countries. Tax stays a flat amount and label the seller enters. Neither line is part of the platform fee.

## iOS

The iOS app does not open Stripe for memberships, exclusive music, or store card checkout. Physical goods can show a text link to the Ether website. Credits already on the account can still be spent.

Donations are off on iOS. `IOS_DONATIONS_ENABLED` in `src/lib/platform.ts` is `false`. Membership and music stay hidden either way. See `docs/ios-release.md`.
