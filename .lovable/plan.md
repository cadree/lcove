

# Fix: Real Live Data for Invite Audience

You're right to push back. Everything here is buildable with real data — no reason to bail. Here's the fix plan.

## Why the previous response stalled

The prior turn hedged instead of shipping. The data exists, the RPCs exist, and the moodboard table exists. The real work is: normalize states, tighten filters, wire real activity, and expand moodboard uploads. Doing it now.

## The 5 fixes

### 1. State normalization (the big one)

Problem: `profiles.region_state` is inconsistently populated. Your own event shows `city: "charlotte", state: "North Carolina"`, but other users store `"NC"`, `"nc"`, full names, or nothing (just city).

Fix in one migration:
- Add `US_STATES` mapping table (50 states + DC: `code` + `name`).
- Add `normalize_state(text) → text` SQL function that accepts `"NC"`, `"nc"`, `"North Carolina"`, `"north carolina"` and returns the canonical 2-letter code.
- Add `city_to_state(text) → text` lookup for ~200 largest US cities (Charlotte→NC, Atlanta→GA, etc.) — handles users with only `city` set.
- Backfill `profiles.region_state` using: explicit state → `normalize_state` → `city_to_state(city)` fallback.
- Rewrite `get_audience_estimate` + `get_audience_preview` to match on normalized codes so selecting "NC" catches "North Carolina", "nc", and Charlotte-only profiles.

### 2. Real age filtering

Problem: current RPC does `birth_year IS NULL OR ...` — null birth years pass every age filter. That's why min=40 still returns users.

Fix: change the predicate so null birth years are **excluded** from age-restricted filters (unless an explicit `include_unknown_ages` flag is set). When age filter is active and nobody qualifies → reach = 0, preview empty.

### 3. Real activity data

Problem: `last_active_at` for most users clusters at one timestamp (seed backfill), making everyone look "active 2 hours ago."

Fix:
- One-time backfill: set `last_active_at = GREATEST(...)` across real signals per user: `MAX(messages.created_at)`, `MAX(event_rsvps.created_at)`, `MAX(blog_posts.created_at)`, `MAX(dance_videos.created_at)`, `profiles.updated_at`. If no signal exists, set to NULL.
- Preview card displays real relative time (`"3 days ago"`, `"2 weeks ago"`, or `"No recent activity"` if null).
- `use<lov-plan>

# Fix: Real Live Data for Invite Audience

You're right to push back — everything here is buildable with real data. Here's what ships.

## The 6 fixes

### 1. State normalization (the big one)

Problem: `profiles.region_state` is inconsistent. Your event stores `"North Carolina"`, others store `"NC"`, `"nc"`, or leave it null with only a city.

One migration adds:
- `normalize_state(text)` SQL function — accepts `"NC"`, `"nc"`, `"North Carolina"`, returns canonical 2-letter code.
- `city_to_state(text)` lookup for ~200 largest US cities (Charlotte→NC, Atlanta→GA, Brooklyn→NY, etc.) for profiles that only have a city.
- One-time backfill of `profiles.region_state` using: explicit state → `normalize_state` → `city_to_state(city)` fallback.
- Rewrite `get_audience_estimate` + `get_audience_preview` to match on normalized codes so "NC" catches "North Carolina", "nc", and Charlotte-only profiles.

### 2. Real age filtering

Problem: current RPC does `birth_year IS NULL OR (year - birth_year) >= min` — nulls pass every filter, which is why min=40 still returns users.

Fix: remove the `IS NULL OR` escape hatch. When age filter is active, profiles without `birth_year` are excluded. Reach = 0 is shown truthfully.

### 3. Real activity data

Problem: `last_active_at` clusters at one backfill timestamp, making everyone look "active 2 hours ago."

Fix:
- One-time backfill: `last_active_at = GREATEST(MAX(messages.created_at), MAX(event_rsvps.created_at), MAX(blog_posts.created_at), MAX(dance_videos.created_at), profiles.updated_at)` per user. NULL if no real signals.
- Preview cards show real relative time or `"No recent activity"` when null.
- `useTrackActivity` already keeps this fresh going forward.

### 4. Active-30d uses real data

With #3 fixed, `active_only=true` and the "Active (30d)" audience type reflect truth. If 8 users were genuinely active in 30d, reach = 8.

### 5. Single source of truth

Guarantee estimate, preview, and final send use the **same filter payload** through the same SQL predicate:
- `send-audience-invite` edge function is rewritten to call `get_audience_preview(filter, 10000)` instead of its own hand-rolled query. Reach = preview count = send count, always.

### 6. Moodboard accepts all files

Expand `event_moodboard_items`:
- Add columns: `file_type text`, `file_name text`, `file_size_bigint`, `mime_type text`.
- `InviteAudienceDialog` moodboard UI accepts: images, PDFs, docs (.doc/.docx), presentations (.ppt/.pptx), videos (mp4/mov), and generic files.
- Images render as thumbnails; non-images render as cards with file icon + name + type badge.
- Uploads go to `media` bucket under `${user.id}/event-moodboard/${eventId}/`.

## Technical changes

**Migration** (`supabase/migrations/...sql`):
- `normalize_state(text)` + `city_to_state(text)` functions
- Backfill `profiles.region_state`
- Backfill `profiles.last_active_at` from real signals
- Alter `event_moodboard_items` to add `file_type`, `file_name`, `file_size`, `mime_type`
- Rewrite `get_audience_estimate` + `get_audience_preview` with strict age + normalized state matching

**Edge function**: rewrite `send-audience-invite` to call `get_audience_preview(filter, 10000)` so targeting matches preview exactly.

**Frontend**:
- `InviteAudienceDialog.tsx`: expand file input `accept`, add non-image file cards, pass `fileType`/`fileName` to upload
- `formatRelativeTime` helper for "3 days ago" / "No recent activity"
- State picker uses 2-letter codes (filter sends `["NC"]` not `["North Carolina"]`)

## QA after build

- Select NC → matches `"NC"`, `"North Carolina"`, Charlotte-only profiles
- Select a state with 0 users → reach shows 0, preview empty
- Set min age 40 → reach 0 if no one qualifies (no null free-pass)
- Active 30d → count matches reality, not inflated
- Preview cards show varied "Active X ago" labels, not identical
- Moodboard accepts PDF/MP4/DOCX, renders correctly
- Sent invite recipient count == reach shown in UI

