# Edge Functions & Secrets

## Required Secrets (configure in Supabase Dashboard → Edge Functions → Secrets)

| Secret | Required For |
|--------|--------------|
| `STRIPE_SECRET_KEY` | Payments, subscriptions, Stripe Connect |
| `RESEND_API_KEY` | Email notifications |
| `MUX_TOKEN_ID` | Live streaming |
| `MUX_TOKEN_SECRET` | Live streaming |
| `TWILIO_ACCOUNT_SID` | SMS notifications |
| `TWILIO_AUTH_TOKEN` | SMS notifications |
| `TWILIO_PHONE_NUMBER` | SMS notifications |
| `VAPID_PRIVATE_KEY` | Push notifications |
| `VAPID_PUBLIC_KEY` | Push notifications |

## Edge Functions to Deploy

Deploy all functions from `supabase/functions/` directory:

```bash
supabase functions deploy --project-ref waafzlorvnozeujjhvxu
```

### Functions List (32 total):
- ai-project-match
- award-credits
- check-connect-status
- check-membership
- check-network-subscription
- check-store-connect-status
- create-connect-account
- create-membership-checkout
- create-network-subscription
- create-store-connect-account
- customer-portal
- mux-stream
- notify-application-accepted
- notify-content-submission
- notify-new-application
- notify-new-content
- process-payout
- purchase-event-ticket
- purchase-store-item
- purchase-studio-booking
- send-contract
- send-dm-notification
- send-individual-message
- send-invoice
- send-mass-notification
- send-notification-email
- send-push-notification
- setup-payout-method
- tip-stream
- transfer-credits
- verify-contribution
- verify-ticket-payment

## Auth Redirect URLs

Configure in Supabase Dashboard → Authentication → URL Configuration:

**Site URL:**
```
https://lcove.lovable.app
```

**Redirect URLs:**
```
app.lovable.e07d9c457fd949f78f3cc7d5998be668://
capacitor://localhost
https://id-preview--e07d9c45-7fd9-49f7-8f3c-c7d5998be668.lovable.app
https://lcove.lovable.app
```
