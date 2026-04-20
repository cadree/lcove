
Phases 1-3 are done (data model, ticket tiers + multi-attendee checkout + My Events, check-in scanner + dashboard rebuild). Phase 4 is the remaining scope from the original brief: public-facing polish, confirmation/reminders, sharing, PDF, calendar, and validation.

Splitting Phase 4 into two sub-phases so it stays shippable.

## Phase 4a — Buyer & Public Experience

**Public event page (PublicEventPage.tsx) upgrade**
- Event type badge (Free RSVP / Paid / Invite Only / Hybrid) derived from `events.event_type` + tiers
- "X spots remaining" + "X people going" social proof from `event_attendees` count
- Single CTA that switches based on event type: RSVP / Buy Ticket / Request Access
- Add-to-calendar dropdown (Google, Apple/ICS, Outlook) — generate ICS client-side
- Share button using `navigator.share` with copy-link fallback (already a memory standard)
- OG meta tags injected per-event for rich link previews

**Confirmation screen (EventConfirmation.tsx)**
- Already exists post-Phase 2; extend with: add-to-calendar buttons, share event button, directions link (maps deep link), "view in My Events" CTA

**Reminders (edge function + cron)**
- Extend `auto-event-reminders` to send 24h + 2h + "starting now" pushes/emails using existing Resend + push infra
- Trigger on `event_attendees` where `status='confirmed'` and `reminder_enabled` not opted out

**Event creation validation**
- Pre-publish checklist in `EventDetailDialog` create flow: title, cover image, date, location, type, description, at least one tier (if paid). Block publish until green.

## Phase 4b — Organizer Tools & Exports

**PDF exports (rebuild `generateEventPdf.ts`)**
- Two modes: `flyer` (1-page visual with cover + QR to public URL) and `details` (full info, tiers, policies, organizer)
- Use jsPDF + html2canvas for cover rendering; QA on mobile download

**Marketing tab (new)**
- Track shares via a new `event_share_events` table (source, referrer, created_at)
- Link-click attribution via `?ref=` query param captured on PublicEventPage
- Counts: views, shares, RSVPs by source

**Team tab (new)**
- New `event_team_members` table: roles `co_host | promoter | check_in_staff`
- Extend `can_manage_event` to also check this table
- UI to invite by email/user search, assign role, revoke

**Error handling pass**
- Audit RSVP, checkout, share, PDF, scanner for silent failures — ensure every catch surfaces a `toast.error` with a real message

## Technical changes

**New tables (migration):**
- `event_share_events` (id, event_id, source, referrer, user_id?, created_at)
- `event_team_members` (id, event_id, user_id, role, invited_by, created_at, unique(event_id, user_id))

**Updated function:**
- `can_manage_event` → also returns true if user is in `event_team_members` with role in (co_host, check_in_staff)

**Updated edge functions:**
- `auto-event-reminders`: add 24h/2h/now windows, query `event_attendees` instead of `event_rsvps`

**New/updated frontend:**
- `src/pages/PublicEventPage.tsx` — major rewrite
- `src/pages/EventConfirmation.tsx` — extend
- `src/components/calendar/AddToCalendarButtons.tsx` — already exists, wire into confirmation + public page
- `src/lib/generateEventPdf.ts` — rewrite for flyer + details modes
- `src/components/events/EventMarketingTab.tsx` — new
- `src/components/events/EventTeamTab.tsx` — new
- `src/pages/EventDetail.tsx` — wire new tabs, add publish checklist

## Recommendation
Approve **Phase 4a first** (buyer experience — biggest conversion impact), then 4b. ~1 day each.

```text
Phase 4a:  Public page + confirmation + reminders + validation
Phase 4b:  PDF + marketing tab + team tab + error audit
```
