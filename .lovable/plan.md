

# Route Event Invites Through the Managed Email Pipeline

## Root cause (confirmed)

The Lovable Email domain `notify.etherbylcove.com` **is verified** and ready. But:

1. The `send-event-invite` edge function still calls **Resend directly** (which has no verified domain → 403).
2. The transactional email scaffold (`send-transactional-email` function + template registry) was never generated, so there is currently no managed pipeline for invites to use.

So even though the domain is live, the invite path bypasses it entirely.

## Fix

### 1. Scaffold the transactional email infrastructure
Generate the `send-transactional-email` edge function, the React Email template registry, the suppression/unsubscribe handlers, and the unsubscribe page. This is a one-time setup.

### 2. Create three host-branded React Email templates
Under `supabase/functions/_shared/transactional-email-templates/`:
- `event-invite.tsx` — invitation to RSVP / buy tickets
- `event-reminder.tsx` — single-recipient reminder
- `event-bulk-attendee-reminder.tsx` — per-attendee reminder

All three accept `templateData` props for: `fromName`, `organizerName`, `replyTo`, `personalNote`, `signature`, `headerImageUrl`, `brandColor`, `eventTitle`, `eventDate`, `eventTime`, `location`, `isFree`, `ticketPrice`, `eventUrl`, `recipientName`, optional `moodboardThumbnails[]`. Visuals reuse the existing `host-event-email-template.ts` look (header band, brand color, host signature, CTA button) — body background stays white per email standards.

Register all three in `registry.ts`.

### 3. Refactor the three edge functions to invoke the pipeline
For each of `send-event-invite`, `send-event-reminder`, `send-bulk-attendee-reminder`:
- Keep `resolveHostIdentity()` to compute the host From name, reply-to, brand assets.
- Replace the direct `fetch("https://api.resend.com/emails", ...)` call with:
  ```
  supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'event-invite',
      recipientEmail: invitee.email,
      idempotencyKey: `invite-${eventId}-${invitee.email}`,
      templateData: { fromName, replyTo, ...eventCtx },
    },
  })
  ```
- Remove all Resend code paths and the `RESEND_API_KEY` dependency for these three functions.
- Keep Twilio SMS path unchanged.
- Keep per-recipient result reporting so the UI still shows sent/failed counts.

### 4. Create the unsubscribe page
A simple `/unsubscribe` route in the app that reads the token, validates against `handle-email-unsubscribe`, and shows confirm/success states. Styled to match the app theme.

### 5. Deploy
Deploy `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, `send-event-invite`, `send-event-reminder`, `send-bulk-attendee-reminder`.

## What stays the same
- Host-branded From name (`{Host} via Ether <events@notify.etherbylcove.com>`) — passed via `fromName` in templateData and rendered in the email.
- Verified reply-to fallback logic.
- SMS via Twilio.
- All existing UI (InviteGuestsDialog, EventEmailIdentitySettings).
- Event branding fields, verification flow.

## Note on From address
Lovable's managed pipeline sends from the project's configured sender address on `notify.etherbylcove.com`. The host personalization (`"Cadre Wallace via Ether"`) appears as the visible sender name; the technical envelope address is the platform's verified address. This is exactly the architecture the previous plan called for.

## QA after fix
- Send invite to an external email → arrives in inbox, From shows host name, reply-to works, event hero/brand color render
- SMS still fires for phone-only invitees
- Reminder + bulk reminder both deliver
- Check `email_send_log` for per-send status (`sent` / `dlq` / `suppressed`)
- Suppressed/unsubscribed emails are auto-blocked
- System emails (password reset etc.) unchanged

## Files

**Created (auto by scaffold):**
- `supabase/functions/send-transactional-email/index.ts`
- `supabase/functions/handle-email-unsubscribe/index.ts`
- `supabase/functions/handle-email-suppression/index.ts`
- `supabase/functions/_shared/transactional-email-templates/registry.ts`
- `src/pages/Unsubscribe.tsx` (+ route in `App.tsx`)

**Created (by me):**
- `supabase/functions/_shared/transactional-email-templates/event-invite.tsx`
- `supabase/functions/_shared/transactional-email-templates/event-reminder.tsx`
- `supabase/functions/_shared/transactional-email-templates/event-bulk-attendee-reminder.tsx`

**Modified:**
- `supabase/functions/send-event-invite/index.ts`
- `supabase/functions/send-event-reminder/index.ts`
- `supabase/functions/send-bulk-attendee-reminder/index.ts`

