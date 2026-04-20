

# Personalized Host-Branded Event Invitations

Redesign event invite/reminder emails so they feel like they come from the host, while keeping system mail generic. Delivery stays on the verified platform domain — no spoofing, no raw host mailboxes.

## Sending architecture

Two clear lanes, both routed through the verified platform domain:

```text
Platform mail   → noreply@notify.etherbylcove.com   (resets, receipts, alerts)
Host event mail → events@notify.etherbylcove.com    (invites, reminders, updates)
                  From name: dynamic per host/event
                  Reply-To:  verified host email (or platform fallback)
```

Three edge functions get the host-branded treatment:
`send-event-invite`, `send-event-reminder`, `send-bulk-attendee-reminder`.
`send-audience-invite` (platform-wide marketing-style blast) keeps the generic platform sender.

## 1. Database additions

New table `event_email_branding` (one row per event, optional override):
- `event_id` (PK, FK)
- `from_name_override` (text, nullable — defaults to host display name)
- `organizer_name` (text, nullable)
- `reply_to_email` (text, nullable)
- `reply_to_verified_at` (timestamptz, nullable)
- `signature` (text, nullable)
- `header_image_url` (text, nullable — falls back to event `image_url`)
- `brand_color` (text, nullable)
- `personal_note` (text, nullable — host's intro line)

New table `host_email_verifications`:
- `id`, `user_id`, `email`, `code_hash`, `expires_at`, `verified_at`, `created_at`
- RLS: user can read/insert own rows only.

RLS on `event_email_branding`: host (`can_manage_event`) can read/write; everyone authenticated can read for events they can RSVP to (so the dialog can preview).

## 2. Edge function: shared host-branding helper

New `supabase/functions/_shared/host-email-identity.ts`:
- `resolveHostIdentity(eventId)` returns:
  ```
  { fromName, fromAddress, replyTo, organizerName,
    headerImageUrl, brandColor, signature, personalNote }
  ```
- Builds RFC-compliant From header: `"Cadre Wallace via Ether" <events@notify.etherbylcove.com>`
- Strips/escapes quotes in display names to prevent header injection.
- Uses verified reply-to only when `reply_to_verified_at IS NOT NULL`, else falls back to `support@notify.etherbylcove.com`.

## 3. Refactor invite/reminder functions

`send-event-invite/index.ts`, `send-event-reminder/index.ts`, `send-bulk-attendee-reminder/index.ts`:
- Replace inline HTML with new shared template builder `buildHostEventEmail(kind, ctx)` in `_shared/host-event-email-template.ts`.
- Template structure:
  - Header band with `header_image_url` (or event `image_url`) + brand color accent
  - Event title + organizer line ("Hosted by {organizerName}")
  - Personalized intro: `"Hey {first_name}, {personal_note || default}"`
  - Event details card (date, time, location, price/free)
  - Optional moodboard preview (up to 3 thumbnails from `event_moodboard_items` if any)
  - Primary CTA button (`RSVP` / `Get Tickets` / `Event Details`)
  - Host signature block (avatar + name + signature text)
  - Small platform footer: `"Sent via ETHER by lcove on behalf of {organizerName}"`
- Use resolved `fromName` and `reply_to` in the Resend payload.
- Fix the broken event URL — replace `${SUPABASE_URL}/functions/v1/share-page/...` with `https://etherbylcove.com/event/${eventId}`.

## 4. UI: "Event Email Identity" panel

New component `src/components/calendar/EventEmailIdentitySettings.tsx`, mounted in the event management page (Marketing/Settings tab):

Fields:
- From Name (default: host display name, editable)
- Organizer Name
- Reply-To Email (with "Verify" button → triggers code flow)
- Personal Note (textarea, used as host intro in invites)
- Signature
- Header Image (upload to existing `media` bucket under `${user.id}/event-branding/`)
- Brand Color (color picker)

Live preview card showing:
```
From: Cadre Wallace via Ether <events@notify.etherbylcove.com>
Reply-To: cadre@example.com (Verified ✓)
Subject: You're invited to Culture Night
[ rendered email preview ]
```

## 5. Reply-to verification flow

New edge function `verify-host-email`:
- Action `request`: generates 6-digit code, stores hash, emails code to the entered address via existing transactional path (subject: "Verify your host reply-to address").
- Action `confirm`: validates code, sets `reply_to_verified_at`.
- Codes expire after 15 min.

UI: inline 6-digit input appears after clicking "Verify", confirms in place, shows green "Verified" badge once done.

## 6. Update existing invite dialogs

`InviteGuestsDialog.tsx` and `InviteAudienceDialog.tsx`:
- Add a small "Sending as: {fromName} via Ether" hint above the Send button, with a link "Customize email identity" that opens the new panel.
- No behavior change to recipient inputs.

## 7. Future architecture (not built now)

Leave hooks for:
- OAuth-connected Gmail/Outlook senders (column `connected_sender_provider` reserved on `event_email_branding`).
- Custom SMTP per host.

## Files

New:
- `supabase/migrations/<ts>_event_email_branding.sql`
- `supabase/functions/_shared/host-email-identity.ts`
- `supabase/functions/_shared/host-event-email-template.ts`
- `supabase/functions/verify-host-email/index.ts`
- `src/components/calendar/EventEmailIdentitySettings.tsx`
- `src/hooks/useEventEmailBranding.ts`

Modified:
- `supabase/functions/send-event-invite/index.ts`
- `supabase/functions/send-event-reminder/index.ts`
- `supabase/functions/send-bulk-attendee-reminder/index.ts`
- `src/components/calendar/InviteGuestsDialog.tsx`
- `src/components/events/InviteAudienceDialog.tsx`
- Event management page (mount the new panel)

## QA

- Send invite as host with no branding configured → recipient sees `"{Host Name} via Ether <events@notify.etherbylcove.com>"`, default intro, event hero image.
- Configure custom From Name + personal note → next invite reflects both.
- Verify reply-to email → recipient hits Reply, goes to host inbox.
- Unverified reply-to → falls back to support address; no spoofing.
- Audience-wide blast (`send-audience-invite`) still uses generic platform sender.
- Password reset / system mail unchanged.
- External guest (no account) receives the same host-branded invite.

