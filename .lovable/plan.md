

## Build: Attendee CRM Profile (Drawer) from Orders

Add a host-facing attendee detail drawer that opens when clicking any order or attendee row, showing full identity, lifetime stats, contact info, cross-event history, tags, notes, and host actions.

## Approach

**UI**: Side drawer (Sheet from right, full-width on mobile) — fast, keeps host in context vs. full-page navigation. Opens from both Orders tab and Attendees tab.

**Data**: Identify an attendee by `attendee_user_id` if present, else fall back to `attendee_email` (handles guest checkouts). Aggregate across ALL events the host can manage (via `can_manage_event` permission filter).

## Database changes (1 migration)

New tables (host-scoped CRM data, isolated per host):

- **`event_attendee_tags`** — `(id, host_user_id, attendee_email, attendee_user_id?, tag, created_at)` — tags are per-host, keyed by email/user_id so they follow the customer across events.
- **`event_attendee_notes`** — `(id, host_user_id, attendee_email, attendee_user_id?, note, created_at, updated_at)` — same scoping.

RLS: only the host (`auth.uid() = host_user_id`) can read/write their own tags/notes.

New RPC **`get_attendee_crm_profile(p_email text, p_user_id uuid?, p_host_id uuid)`** returns JSON:
- identity (profile if user_id matches: display_name, avatar, username, joined_at, city, social_links, phone)
- lifetime stats across host's events (events_attended, tickets_purchased, lifetime_spend_cents, rsvp_count, no_show_count, first_event, last_event)
- order history (ticket_orders + tier names + event titles) — host's events only
- event history (event_attendees rows + check-in status) — host's events only
- tags + notes (from new tables)

This keeps everything in one round-trip and enforces the "host can only see attendees from their own events" boundary.

## Frontend changes

**New files:**
- `src/hooks/useAttendeeCrmProfile.ts` — useQuery wrapping the RPC + mutations for tags/notes/resend-receipt/cancel-order.
- `src/components/events/AttendeeProfileDrawer.tsx` — the drawer with sections:
  1. **Header** — avatar, name, username, joined date, "Member since"
  2. **Stats row** — events attended, tickets, lifetime spend, no-shows, last event
  3. **Contact** — email, phone, city, socials, copy buttons, mailto/tel/IG deep links
  4. **Order history** — list across all host events (event title, tier, qty, total, status, date)
  5. **Event history** — RSVP/ticket per event with check-in badge
  6. **Tags + Notes** — add/remove tags (chip input), free-text notes (autosave)
  7. **Actions** — Resend receipt (via `send-rsvp-confirmation` edge fn), Cancel order (Stripe refund via existing flow), Copy email/phone, Open Instagram

**Edited files:**
- `src/pages/EventDetail.tsx` — make order rows + attendee rows clickable; add `selectedAttendee` state; mount `<AttendeeProfileDrawer />`. Touch both `OrdersTabV2` and `AttendeesTabV2`.
- Reuse existing `send-rsvp-confirmation` edge function for "Resend receipt"; reuse existing refund logic for cancel (or stub with a clear "coming soon" toast if no refund endpoint exists yet — will check during build).

## Edge cases handled

- No phone/email/social → field hidden, not "null"
- Guest-only attendee (no user_id) → identity falls back to attendee_name + email, no profile avatar
- Multiple orders same event → all listed
- Refunded orders → status badge (Refunded), excluded from lifetime spend
- Empty tags/notes → inline empty state with "Add first tag/note"
- Sparse data → skeleton then graceful "—"

## QA plan (post-build)

- Click order row → drawer opens with correct attendee
- Click different orders for same email → shows aggregated history
- Lifetime spend matches sum of paid `ticket_orders.total_cents` minus refunds
- Tag added on Event A visible when opening same attendee from Event B
- Note autosaves and persists on reopen
- Guest (no account) loads without crash
- Mobile: drawer full-width, scrollable, action buttons reachable
- RLS: second host cannot see first host's tags/notes (verified by query)

## Out of scope (flagged for future)

- Promoter/referral attribution UI (data not yet captured per-order — would need `ticket_orders.referral_source` column)
- SMS/email opt-in toggles (no `marketing_consent` column yet)
- Communication history log (no message log table for events yet)

These will be noted in the final summary as recommended next steps.

