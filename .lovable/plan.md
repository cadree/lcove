

# Enhanced Event Sharing, Flyer Generation, and Automated Notifications

This plan covers five interconnected improvements to the event system: better share options, auto-generated flyers for social media, automated reminder notifications, host-initiated SMS/email reminders, and guest notification infrastructure.

---

## What Gets Built

1. **Expanded Share Menu** — Add Instagram Stories, iMessage/SMS, WhatsApp, Facebook, and native share options to the event share dropdown. The shared link always points to the public event page (`/event/:id`) which already has guest RSVP forms.

2. **Auto-Generated Event Flyer** — A new edge function (`generate-event-flyer`) that uses canvas rendering to create a branded 1080x1920 (Instagram Story) or 1200x630 (feed) image from the event data (title, date, time, venue, cover image, QR code linking to RSVP page). When sharing to Instagram or downloading, the flyer is generated and provided as a shareable image.

3. **Automated Event Reminders** — A new edge function (`auto-event-reminders`) triggered by a pg_cron job that runs hourly, checking for events happening in 24 hours and 1 hour. It sends email reminders (via Resend) and push notifications to all attendees (both members and guests). Guest email/push already supported via `guest_push_subscriptions` and `event_rsvps.guest_email`.

4. **Host "Send Reminder" Button** — Already partially exists (`send-event-reminder` edge function). Enhance the EventDetailDialog and EventAttendeesDialog to let hosts send custom reminders anytime via email AND SMS (Twilio) to all attendees including guests.

5. **SMS Notifications for Guests** — Extend `send-event-reminder` to also text guests who provided phone numbers. Add a dedicated "Text All Guests" action for hosts using the existing Twilio integration.

---

## Technical Details

### 1. Share Menu Enhancements (`EventDetailDialog.tsx`)
- Add share options: Instagram (via native share with flyer image), SMS/iMessage (`sms:?body=...`), WhatsApp (`https://wa.me/?text=...`), Facebook (`https://www.facebook.com/sharer/...`)
- For Instagram: generate flyer first, then trigger native share with the image file
- For SMS: use `sms:?&body=` URL scheme which opens iMessage/Messages on iOS
- The shared URL remains `https://etherbylcove.com/event/{id}` pointing to `PublicEventPage`

### 2. Event Flyer Generator Edge Function
- New edge function: `supabase/functions/generate-event-flyer/index.ts`
- Uses `@vercel/og` or server-side HTML-to-image approach (Satori) to render a styled flyer
- Inputs: event ID (fetches title, date, venue, cover image from DB)
- Outputs: PNG image (1080x1920 for stories, 1200x630 for feed)
- Includes: event title, date/time, venue, cover image as background, QR code to RSVP link, ETHER branding
- Caches generated flyers in the `media` storage bucket at `event-flyers/{eventId}.png`
- Client downloads the image and uses `navigator.share({ files: [flyerFile] })` for Instagram sharing

### 3. Automated Reminder System
- New edge function: `supabase/functions/auto-event-reminders/index.ts`
- New pg_cron job running every 30 minutes
- Checks for events starting in 24h and 1h windows
- Tracks sent reminders via a new `event_reminder_log` table to avoid duplicates
- Sends to:
  - **Members**: email (Resend) + in-app notification
  - **Guests**: email (Resend) + push notification (existing `guest_push_subscriptions`)
  - **SMS**: to anyone with a phone number (Twilio)

### 4. Database Migration
- New table `event_reminder_log`:
  - `id UUID PK`, `event_id UUID`, `reminder_type TEXT` (24h, 1h, custom), `sent_at TIMESTAMPTZ`, `recipient_count INT`
  - Prevents duplicate automated reminders
- New table `event_flyers`:
  - `id UUID PK`, `event_id UUID UNIQUE`, `flyer_url TEXT`, `created_at TIMESTAMPTZ`
  - Caches generated flyer URLs

### 5. Host Controls Enhancement
- Add "Send Reminder to All Guests" button in EventDetailDialog (visible to host)
- Add "Text All Guests" button that sends SMS via `send-event-reminder` edge function
- Update `send-event-reminder` to also send SMS to guests with phone numbers via Twilio
- Add custom message input for host reminders

### 6. PublicEventPage Updates
- After guest RSVP, automatically offer push notification opt-in (already exists)
- Add checkbox for "Email me reminders about this event" (already captured via guest_email)
- Ensure the page works as the landing destination for all shared links

---

## Files to Create
- `supabase/functions/generate-event-flyer/index.ts` — Flyer image generator
- `supabase/functions/auto-event-reminders/index.ts` — Cron-triggered automated reminders
- Database migration for `event_reminder_log` table

## Files to Modify
- `src/components/calendar/EventDetailDialog.tsx` — Expanded share menu with flyer download, SMS, WhatsApp, Instagram, Facebook; host reminder controls
- `supabase/functions/send-event-reminder/index.ts` — Add SMS sending for guests with phones
- `supabase/functions/share-page/index.ts` — Ensure event OG image uses flyer if available

