

# Marketing & Notification System Upgrade

Transform the Marketing tab into a 3-section operator console with individual reminders, bulk targeting, and platform-wide audience invites.

## Scope (one phase, shipped together)

### 1. Database (1 migration)

**New columns on `profiles`** (for audience targeting):
- `interests text[]` (e.g. music, fashion, art, nightlife)
- `region_state text`, `region_country text` (city already exists)
- `gender text` (nullable, optional self-report)
- `birth_year int` (nullable — age band only, not exact DOB)
- `last_active_at timestamptz` (touched on auth/session refresh)
- GIN index on `interests`, btree on `city_key`, `last_active_at`, `birth_year`

> Passions already exist via `user_passions` + `passions` tables — reuse, don't duplicate.

**New table `notification_logs`**:
- `id, campaign_id, user_id?, recipient_email?, recipient_phone?, event_id?, host_user_id, type` (`reminder|invite|blast`), `channel` (`push|email|sms|in_app`), `status` (`queued|sent|delivered|opened|clicked|failed|bounced`), `error_message`, `sent_at`, `opened_at`, `clicked_at`, `metadata jsonb`
- RLS: host can read their own logs

**New table `notification_campaigns`** (parent for analytics rollups):
- `id, host_user_id, event_id?, name, type, title, body, channels text[], audience_filter jsonb, recipient_count, sent_count, opened_count, clicked_count, rsvp_conversions, created_at`
- RLS: host owns their campaigns

**New table `event_auto_reminders`**:
- `event_id (PK), enabled_24h bool, enabled_2h bool, enabled_at_door bool, last_24h_sent_at, last_2h_sent_at`

**New RPC `get_audience_estimate(filter jsonb)`** — returns count of matching active users without exposing PII.

**New RPC `get_campaign_analytics(host_id uuid, event_id uuid?)`** — aggregates from `notification_logs` for the dashboard.

### 2. Edge Functions

**New `send-individual-reminder`** — single attendee, channels resolved per recipient (push if Ether user, fallback email, fallback SMS), variable substitution (`{first_name}`, `{event_name}`, `{event_time}`, `{ticket_type}`), logs to `notification_logs`.

**New `send-bulk-attendee-reminder`** — same as above but iterates a filtered attendee list (tier, status, purchase date), throttled with delays, batched logs.

**New `send-audience-invite`** — platform-wide. Resolves audience from `profiles` + `user_passions` + filters, respects `notification_preferences`, prefers push for active Ether users, fallbacks to email/SMS, writes one `notification_campaigns` row + N `notification_logs` rows.

**Update `auto-event-reminders`** (existing cron) — read `event_auto_reminders` flags, fire `send-bulk-attendee-reminder` at 24h/2h windows, update `last_*_sent_at`.

**New `track-notification-open`** — public GET endpoint that returns 1×1 pixel + marks `opened_at`. Click tracking via `track-notification-click` redirect.

### 3. Frontend

**New components**:
- `src/components/events/SendReminderDialog.tsx` — single-attendee modal: editable preview, channel toggles (auto-disabled if no phone/not Ether user), 3 quick templates, variable chips, send button.
- `src/components/events/BulkReminderDialog.tsx` — Marketing tab dialog: filter form (tier multi-select, RSVP status, purchase date range), live recipient count, channel toggles, message builder, preview, send.
- `src/components/events/InviteAudienceDialog.tsx` — primary new feature: filter builder (region radius via city + state + country, age range from `birth_year`, gender, interests multi-select, passions multi-select via `passions` table, "active in last 30d" toggle), live audience estimate (debounced RPC call), message builder, channel preference, preview, send. Includes "Lookalike Expansion" toggle (auto-pulls interests/passions of current attendees and unions filter).
- `src/components/events/AutoReminderSettings.tsx` — toggle card (24h, 2h, at-door) wired to `event_auto_reminders`.
- `src/components/events/CampaignAnalyticsCard.tsx` — total sent / open rate / click rate / RSVP conversions / top segments table from `get_campaign_analytics`.

**New hook `src/hooks/useNotificationCampaigns.ts`** — CRUD + analytics queries.

**Edited files**:
- `src/pages/EventDetail.tsx` — rebuild `MarketingTab` into 3 sections (Email Blast / Push Notifications / **Invite Audience** primary), mount auto-reminder settings + analytics. Add "Send Reminder" action button to each row in `OrdersTabV2` and `AttendeesTabV2` (icon button, opens `SendReminderDialog`).
- `src/components/events/AttendeeProfileDrawer.tsx` — add "Send Reminder" action in the actions section.

### 4. Profile capture (lightweight)

- Add an optional "Targeting & preferences" section to Settings/Profile edit (interests checklist, gender, birth year, state/country) — required only for hosts to receive invites; not blocking for existing users.
- `last_active_at` updated by a tiny `useTrackActivity` hook on auth resume.

### 5. Channel resolution rules

For each recipient in this order:
1. Has push subscription + active in 30d → **push** (primary)
2. Else has email + email_enabled → **email**
3. Else has phone + sms_enabled → **SMS**
4. Always also write `in_app` notification row

Host can override channels per send; resolver only picks among enabled ones.

### 6. Tracking

- Open tracking: 1×1 pixel in email HTML pointing to `track-notification-open?log_id=...`
- Click tracking: all event links rewritten through `track-notification-click?log_id=...&to=...`
- Push opens tracked via existing `sw.js` (already deep-links — extend to POST log_id back)
- Conversions: when a user RSVPs, check `notification_logs` for recent invite to same event by same user/email and increment `notification_campaigns.rsvp_conversions`

## Out of scope (flagged)

- A/B testing of message variants
- Saved audience segments (can be added later by storing `audience_filter` jsonb as a named row)
- Deliverability dashboards (bounce/complaint webhooks) — wire later via Resend webhook

## Files touched (summary)

```
NEW  supabase/migrations/<ts>_marketing_system.sql
NEW  supabase/functions/send-individual-reminder/index.ts
NEW  supabase/functions/send-bulk-attendee-reminder/index.ts
NEW  supabase/functions/send-audience-invite/index.ts
NEW  supabase/functions/track-notification-open/index.ts
NEW  supabase/functions/track-notification-click/index.ts
EDIT supabase/functions/auto-event-reminders/index.ts
NEW  src/components/events/SendReminderDialog.tsx
NEW  src/components/events/BulkReminderDialog.tsx
NEW  src/components/events/InviteAudienceDialog.tsx
NEW  src/components/events/AutoReminderSettings.tsx
NEW  src/components/events/CampaignAnalyticsCard.tsx
NEW  src/hooks/useNotificationCampaigns.ts
NEW  src/hooks/useTrackActivity.ts
EDIT src/pages/EventDetail.tsx (MarketingTab rebuild + row actions)
EDIT src/components/events/AttendeeProfileDrawer.tsx (Send Reminder action)
EDIT src/pages/Settings.tsx (targeting prefs section)
```

## QA checklist (run after build)

- Single reminder via Orders row → push received + log row created
- Bulk reminder filtered to "confirmed, GA tier" → only matching attendees notified
- Invite Audience with city + interest filter → estimate matches actual send count
- Lookalike toggle expands estimate
- Auto-reminder cron fires at 24h/2h windows, doesn't double-send
- Variable substitution renders correctly in email + push + SMS
- Open pixel marks `opened_at`
- Analytics card reflects sent/opened/clicked
- Non-Ether attendee gets email fallback (no push attempt)

