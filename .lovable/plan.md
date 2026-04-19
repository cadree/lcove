

## What's actually broken vs. missing

After reading the code:

**Image upload** — the code path is correct (`media` bucket, `${user.id}/event-images/...` matches the storage RLS rule). Session replay actually shows you DID create an event successfully ("Event created!" toast). The likely real issues: (1) no error surfacing if a HEIC/large/odd file is picked, (2) no progress feedback past "Uploading…", (3) the file input doesn't reset so picking the same file twice silently fails. I'll harden it.

**Moodboard** — does not exist. Needs to be added.

**RSVP confirmation email** — does not exist. `useRSVP` only writes to DB and shows a toast.

**Reminders** — only 24h + 1h windows exist in `auto-event-reminders`. You want **5 stages**: confirmation, 1 week, 1 day, 5 hours, 30 minutes.

**My Tickets on profile** — `ProfileEventsDashboard` only shows events you HOST, not events you RSVP'd to.

---

## Plan

### 1. Fix + harden event image upload (`CreateCommunityEventDialog`)
- Accept HEIC/HEIF, JPEG, PNG, WEBP, GIF explicitly.
- Reset `<input value>` after each pick so re-selecting the same file works.
- Show file name + spinner overlay during upload; surface real Supabase error message in toast.
- Increase limit to 10MB, log errors to console with full context.

### 2. Add Moodboard / Itinerary section
**DB migration** — new table:
```
event_moodboard_items (
  id uuid PK, event_id uuid FK→events ON DELETE CASCADE,
  type text CHECK (type IN ('image','link','note','itinerary')),
  media_url text, link_url text, title text, body text,
  start_time timestamptz NULL,  -- for itinerary entries
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
)
```
RLS:
- SELECT: anyone if parent `events.is_public=true`, else creator/org members/RSVP'd users.
- INSERT/UPDATE/DELETE: event creator only.

**UI**:
- In `CreateCommunityEventDialog` and `EventDetail` (host editor): new "Moodboard & Itinerary" section — drag-to-reorder cards with type tabs (Image / Link / Note / Itinerary entry with time).
- In **public** `EventDetail` / `PublicEventPage` / `EventDetailDialog`: render a "Vibes & Itinerary" section — itinerary entries shown as a timeline (sorted by `start_time`), images/notes shown as a grid.
- Storage path: `${user.id}/event-moodboards/${eventId}/...`.

### 3. RSVP confirmation email + 5-stage reminders
**Schema additions** (`event_reminder_log` already exists):
- Extend `reminder_type` accepted values to: `confirmation`, `1week`, `1day`, `5hour`, `30min`, plus existing `24h`, `1h`, `custom`.
- New column `event_rsvps.confirmation_sent_at timestamptz` to dedupe confirmations per RSVP.

**Edge function: `send-rsvp-confirmation`** (verify_jwt=false, callable by client + service)
- Takes `{ event_id, rsvp_id }`, looks up event + recipient (auth user email or guest_email), sends a beautiful confirmation email with: title, date/time, venue, address, cover image, .ics attachment link, link to event page, "Add to Calendar" buttons.
- Sets `confirmation_sent_at = now()`.
- Triggered from `useRSVP` after successful insert/update to status `going`, AND from `purchase-event-ticket` after successful purchase, AND for guest RSVPs on `PublicEventPage`.

**Rewrite `auto-event-reminders`** to handle 5 windows:
| Type | Hours ahead | Tolerance |
|---|---|---|
| `1week` | 168 | 30 min |
| `1day` | 24 | 30 min |
| `5hour` | 5 | 30 min |
| `30min` | 0.5 | 10 min |

(Confirmation is on-RSVP, not time-based; 1h/24h legacy types stay supported but aren't scheduled anymore.)

For each window: find events whose `start_date` falls in the window, find each RSVP with `status='going'` and `reminder_enabled=true`, dedupe via `event_reminder_log (event_id, reminder_type, recipient_email)` — change log to be **per-recipient** (add `recipient_email text`) so adding a new RSVP after a window fires still gets future reminders, and the same address never gets the same window twice.

**Cron schedule**: ensure pg_cron job runs `auto-event-reminders` every 10 minutes (already documented pattern). I'll add the SQL to (re)create the cron job.

Each email matches the existing branded template style (pink #e91e8c CTA, etherbylcove.com domain, sender `notifications@etherbylcove.com`).

### 4. "My Tickets" section on Profile
- New component `ProfileMyTickets.tsx` (own profile only).
- Hook `useMyRSVPs.ts`: queries `event_rsvps` where `user_id = me AND status IN ('going','interested')`, joins `events` for full details, splits into **Upcoming** and **Past** with countdown badges.
- Each ticket card shows cover image, date/time, venue, status badge (Going / Interested / Ticket Purchased), buttons: View Event, Add to Calendar, Cancel RSVP.
- Tapping opens existing `EventDetailDialog`.
- Mounted in `Profile.tsx` next to `ProfileEventsDashboard` (visible only when `isOwnProfile && hasAnyRSVPs`). Add layout key `'my_tickets'`.

### 5. Files touched
**New**:
- `supabase/migrations/<ts>_event_moodboard_and_reminders.sql`
- `supabase/functions/send-rsvp-confirmation/index.ts`
- `src/components/calendar/EventMoodboardEditor.tsx` (host)
- `src/components/calendar/EventMoodboardView.tsx` (public)
- `src/hooks/useEventMoodboard.ts`
- `src/hooks/useMyRSVPs.ts`
- `src/components/profile/ProfileMyTickets.tsx`

**Edited**:
- `src/components/calendar/CreateCommunityEventDialog.tsx` — harden upload, mount `EventMoodboardEditor` (after event created in a step 2).
- `src/hooks/useCalendar.ts` — call `send-rsvp-confirmation` from `useRSVP` on going.
- `supabase/functions/purchase-event-ticket/index.ts` — invoke confirmation after success.
- `supabase/functions/auto-event-reminders/index.ts` — 5-window logic + per-recipient dedupe.
- `src/pages/EventDetail.tsx` — show moodboard tab for host.
- `src/components/calendar/EventDetailDialog.tsx` + `src/pages/PublicEventPage.tsx` — render `EventMoodboardView`.
- `src/pages/Profile.tsx` — mount `ProfileMyTickets`.

### 6. Test
1. Create event → upload cover image (JPG, then HEIC) → both succeed with progress shown.
2. Add 3 moodboard items (image, note, itinerary entry with time) → save → open public event → see "Vibes & Itinerary" with timeline.
3. RSVP "Going" as another logged-in user → receive **confirmation email** within 30s; check spam.
4. Set event start to ~7 days away → wait for cron tick → receive 1-week reminder; verify dedupe (no duplicate sent on next tick).
5. Visit own profile → "My Tickets" section shows the RSVP'd event → tap → opens detail.
6. Cancel RSVP from My Tickets → row disappears, future reminders stop.

