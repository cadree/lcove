

# Event Dashboard & Payout System Audit

## Executive Summary

This audit reveals **critical gaps** in the event ticketing and payout infrastructure. While the dashboard displays revenue metrics, **event hosts cannot actually receive any money from ticket sales**. The payment flows exist but the money goes directly to the platform with no mechanism to transfer funds to event creators.

---

## Current State Analysis

### What Works

1. **Dashboard Display** - Shows correct metrics:
   - Total events, attendees, revenue, credits earned
   - Sales charts with 6-month historical data
   - Recent orders list with ticket purchases
   - Upcoming events with RSVP/ticket counts

2. **Ticket Purchase Flow** - Functional:
   - `purchase-event-ticket` edge function creates Stripe Checkout sessions
   - `verify-ticket-payment` confirms payment and marks RSVP as `ticket_purchased`
   - Transaction records are created in `transactions` table

3. **Credit-Based Tickets** - Partially working:
   - Users can spend LC Credits for event tickets
   - `credits_spent` is recorded on RSVP

4. **Wallet Payout Infrastructure** - Exists for LC Credits:
   - Users can add payout methods (cards)
   - Users can convert Earned Credits to cash payouts

---

## Critical Issues Found

### Issue 1: No Stripe Connect for Events (BLOCKER)

**The `events` table lacks Stripe Connect fields.**

| Table | Has `stripe_connect_account_id`? | Has `payout_enabled`? |
|-------|----------------------------------|----------------------|
| `stores` | Yes | Yes |
| `networks` | Yes | Yes |
| `events` | **NO** | **NO** |

**Impact**: When someone buys an event ticket, the payment goes to the platform's Stripe account with **no automatic transfer** to the event host.

### Issue 2: Missing Host Revenue Credit Flow

When a user purchases a ticket via Stripe:
1. Payment is received by platform Stripe account
2. `event_rsvps.ticket_purchased = true` is set
3. Transaction is recorded for the **buyer** only

**Missing**: 
- No credit to event creator's `user_credits.earned_balance`
- No entry in `credit_ledger` for the host
- No 80/20 revenue split like Store/Network modules

### Issue 3: Dashboard Revenue is Display-Only

The `useEventDashboard` hook calculates revenue by multiplying ticket price × ticket count:
```typescript
totalRevenue: rsvps?.reduce((sum, r) => {
  if (r.ticket_purchased && r.stripe_payment_id) {
    return sum + (event?.ticket_price || 0);
  }
  return sum;
}, 0)
```

This shows what the host **should have earned**, not what they **actually received** (which is $0).

### Issue 4: Credit Ticket Sales Don't Credit the Host

When users pay with LC Credits:
```typescript
// Current code in EventDetailDialog.tsx
await supabase.functions.invoke('award-credits', {
  body: {
    userId: user.id,  // ← This is the BUYER's ID
    amount: -(event.credits_price || 0),
    ...
  }
});
```

Credits are deducted from the buyer, but **never awarded to the host**.

### Issue 5: No Host Onboarding for Payouts

Unlike Cinema networks and Stores, there's no way for event hosts to:
- Set up a Stripe Connect account
- Enable payouts for their events
- View their actual payout balance

---

## Required Fixes

### Phase 1: Database Schema Updates

Add payout infrastructure to events:

```sql
-- Add Stripe Connect fields to events
ALTER TABLE public.events 
ADD COLUMN stripe_connect_account_id text,
ADD COLUMN payout_enabled boolean DEFAULT false;

-- Or alternatively, add to profiles for user-level connect
ALTER TABLE public.profiles 
ADD COLUMN stripe_connect_account_id text,
ADD COLUMN payout_enabled boolean DEFAULT false;
```

### Phase 2: Create Event Host Connect Onboarding

Create new edge function: `create-event-connect-account`
- Similar to `create-connect-account` (for networks)
- Links to user's profile or organization
- Generates Stripe Express account onboarding link

### Phase 3: Update Ticket Purchase Flow

Modify `purchase-event-ticket` to support Stripe Connect:

```typescript
// Fetch event with creator's connect account
const { data: event } = await supabase
  .from('events')
  .select(`
    *, 
    creator:profiles!creator_id(stripe_connect_account_id, payout_enabled)
  `)
  .eq('id', eventId)
  .single();

// If creator has connect enabled, use application fee
if (event.creator?.stripe_connect_account_id && event.creator?.payout_enabled) {
  const platformFeeAmount = Math.round(ticketPrice * 100 * 0.20); // 20% platform fee
  
  session = await stripe.checkout.sessions.create({
    ...sessionConfig,
    payment_intent_data: {
      application_fee_amount: platformFeeAmount,
      transfer_data: {
        destination: event.creator.stripe_connect_account_id,
      },
    },
  });
}
```

### Phase 4: Credit-Based Revenue Split

Update `EventDetailDialog.tsx` credit purchase to credit the host:

```typescript
// Award 80% to event creator
await supabase.functions.invoke('award-credits', {
  body: {
    target_user_id: event.creator_id,
    amount: Math.floor(event.credits_price * 0.8),
    description: `Ticket sale: ${event.title}`,
    reference_type: 'event_ticket',
    reference_id: event.id
  }
});
```

### Phase 5: Add Connect Status UI to Event Dashboard

Add a "Payout Settings" section to the Event Dashboard:
- Show Connect onboarding status
- Display pending vs. available balance
- Allow hosts to view payout history

---

## File Changes Required

| File | Change |
|------|--------|
| `migration/XX-events-payout.sql` | Add `stripe_connect_account_id`, `payout_enabled` to profiles or events |
| `supabase/functions/create-event-connect-account/index.ts` | New function for host onboarding |
| `supabase/functions/check-event-connect-status/index.ts` | New function to check connect status |
| `supabase/functions/purchase-event-ticket/index.ts` | Add Stripe Connect payment split |
| `supabase/functions/verify-ticket-payment/index.ts` | Credit host for ticket sale |
| `src/components/calendar/EventDetailDialog.tsx` | Fix credit purchase to credit host |
| `src/pages/Dashboard.tsx` | Add payout status section |
| `src/hooks/useEventDashboard.ts` | Add actual payout balance tracking |

---

## Recommended Implementation Order

1. **Schema Update** - Add connect fields to profiles/events
2. **Connect Onboarding** - Create edge functions for host setup
3. **Payment Split** - Update purchase-event-ticket with application_fee
4. **Credit Split** - Fix credit-based purchases
5. **Dashboard UI** - Add payout settings and status
6. **Testing** - End-to-end payment flow verification

---

## Verification Checklist After Implementation

- [x] Database schema updated with stripe_connect_account_id and payout_enabled on profiles
- [x] Event host can complete Stripe Connect onboarding (create-event-connect-account)
- [x] Paid ticket purchases split 80/20 (host/platform) via Stripe Connect
- [x] Credit ticket purchases split 80/20 (host/platform) via award-credits
- [x] verify-ticket-payment credits host's earned_balance if no Connect
- [x] Payout Settings UI added to Dashboard showing Connect status and balances
- [ ] Host can request payout to their bank/card (via Stripe Express Dashboard)
- [ ] End-to-end testing of full payment flow

