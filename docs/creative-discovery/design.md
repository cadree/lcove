# Creative discovery and travel planning

## Agreed scope

Reference: user's `maps on app.mov` and `globe.jpg`. Replace the Directory's city chip layout with a dark, rotatable globe, city photo markers with counts, a horizontal city/state rail, and a lower panel of creative cards (bio and portfolio preview). Keep Ether's navigation and accessible tap alternatives to gestures. Discovery is opt-in and uses a chosen city, never live GPS or a street address. Hide blocked/ineligible profiles, and do not infer private location from posts.

Mutual private likes create/reuse one personal chat atomically. Passing is private. Unmatching closes the match authorization; blocking remains stronger. Settings offers Open DMs / Matches only, enforced for direct sends, old threads, alternate message entry points, and participant insertion. Joining a trip explicitly consents to that group only; it never unlocks private DMs.

Travel first version: pledges and expense records only, per user approval on November 14, 2026. No charging, wallet, custody, payouts, or automated reservations. No user is described as paid or financially approved just because they pledged.

## Trip rules

- A destination alone is not enough: list trips by destination and overlapping dates, capacity and intent; users review and explicitly join a specific group.
- Show roster before joining, and reject joining if either-direction blocks exist. Create the group transactionally with the trip; duplicate taps must not create duplicate memberships.
- A trip has one currency (USD initially), integer cents, itemized quotes, taxes/fees included in estimates, dates and cancellation notes. Never invent live hotel or rental quotes.
- Equal shares include the organizer; distribute remainder cents deterministically. Example: $1,500 lodging + $500 car = $2,000; four travelers pledge $500 each. Payment outside Ether is separately self-reported, never verified funds.
- Budget and membership changes invalidate prior approval. Each member approves the exact current budget and their share. Unanimity is required before recording an agreed booking; silence is not approval. An organizer cannot approve for someone else.
- Quotes precede purchases. Receipts follow purchases: a pre-purchase receipt cannot exist. Record a quote/link for approval, then record the actual receipt and amount after booking externally. Everyone confirms the receipt before the expense is marked complete.
- Once receipts exist, freeze roster/budget so nobody can shrink the approval set or rewrite an approved purchase. Cancel instead of silently changing the agreement; preserve history and settle actual reimbursements outside Ether.
- Members can withdraw before any booking is recorded; this invalidates approvals and recalculates shares. The organizer can cancel, cannot kick a contributor to manufacture unanimity, and cannot mark another person's share paid.
- Cancellations preserve records. Receipt corrections and disputed bookings need a new agreement/support review; do not overwrite evidence. Refunds are actual supplier outcomes, not promised by the app.

## Real-money follow-up (not implemented)

Before collecting real money, validate the business model and provider support, supplier purchasing mechanism, identity requirements, cancellation/refund/chargeback responsibilities, jurisdiction and ages. A Stripe balance is not an escrow product, a card authorization expires, and a Connect transfer is not a purchase from Airbnb. A group vote cannot itself grant a card or pay a supplier. Use provider-confirmed events, idempotency, a double-entry ledger, bounded approvals and a reconciliation process before enabling money movement.

Sources reviewed: https://docs.stripe.com/payments/place-a-hold-on-a-payment-method and https://docs.stripe.com/connect/separate-charges-and-transfers .

## Verification and release

New branch/PR; never push to the live branch. SQL files are for manual review/application, not executed against staging or production by this task. Validate the new database functions in a disposable local database where possible, including concurrent matches, permission bypass attempts, membership changes and approval invalidation. Browser checks at 390, 820 and desktop widths, plus touch/VoiceOver and native-device follow-up. Do not claim deployed availability from local UI tests.
