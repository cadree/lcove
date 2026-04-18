

## Plan: Public-Facing Exclusive Music Storefront with Previews, Saves & Downloads

### What's broken vs. what we need
- Tracks hidden behind `if (!isOwner && tracks.length === 0) return null` — but they ARE shown (just compactly). Real issue: cards are too small/private-looking, no preview generation, no save flow, no download permission, no "saved music" library.
- No 15s preview enforcement — currently plays full `preview_clip_url` if set, otherwise nothing.
- No durable purchase library / saved-to-profile concept.
- No download toggle per track.

---

### 1. Database changes (one migration)

**Alter `exclusive_tracks`** — add:
- `allow_downloads` boolean default false
- `visible_on_profile` boolean default true
- `preview_start_seconds` integer default 0
- `preview_duration_seconds` integer default 15

**New table `music_saves`** — buyer's library + "added to my profile" flag:
- `id`, `user_id`, `track_id` (FK exclusive_tracks), `added_to_profile` boolean default false, `created_at`
- Unique (user_id, track_id)
- RLS: user can SELECT/INSERT/UPDATE/DELETE own rows; public SELECT where `added_to_profile = true` (so saved tracks appear on profiles)

**RLS on `exclusive_tracks`** — confirm public SELECT for `is_published = true` rows (so non-owners see them on profiles).

No new tables for purchases (already exists) or subscriptions (exists).

### 2. Preview generation strategy

**Client-side, on-the-fly** — no storage cost, no edge function needed:
- Locked viewers get `<audio src={audio_file_url}>` with a controller that:
  - Seeks to `preview_start_seconds` on play
  - Stops at `preview_start_seconds + preview_duration_seconds` (15s)
  - Disables seek bar / right-click download
- Audio file URL is public (in `media` bucket) but the UI-enforced 15s window + no download button keeps it functionally a preview
- Owners can optionally upload a separate `preview_clip_url` for true protection (kept as existing field)

This avoids needing ffmpeg in an edge function for MVP.

### 3. UI changes

**`ExclusiveTrackCard.tsx`** — redesign as storefront card:
- Always visible (no truthy gate)
- Larger artwork (h-32 grid) instead of tiny 14×14
- Status badge: `Free` / `$X.XX` / `Subscribers Only` / `Unlocked` / `Owned`
- **Play preview** button (15s clipped) for everyone
- **Buy / Subscribe** CTAs for non-owners without access
- Post-purchase: **Save to Library** + **Add to Profile** + **Download** (if `allow_downloads`)
- Owner: edit settings (price, allow_downloads toggle, visible_on_profile toggle, preview start time)

**`ExclusiveMusicSection.tsx`**:
- Remove `if (!isOwner && tracks.length === 0) return null` gate — show empty state for visitors too if artist has none, OR just hide cleanly
- Add upload form fields: `Allow downloads` switch, `Preview start (seconds)` input
- Grid layout (2 cols mobile, 3 cols desktop) instead of vertical list
- Header: "Exclusive Music" with track count

**New `SavedMusicSection.tsx`** — shows on a user's own profile:
- Lists tracks where `music_saves.user_id = profile_owner AND added_to_profile = true`
- Each card shows: artwork, title, **original artist** (linked to their profile), play button
- Attribution preserved — never shows saver as the uploader

**`Profile.tsx`** — mount `SavedMusicSection` below `MusicProfileBlock`.

### 4. New hook: `useMusicLibrary.ts`
- `useMyPurchases()` — list of purchased tracks for current user
- `useMySaves()` — saved/added-to-profile tracks
- `useSavedTracksForProfile(userId)` — public query of saves marked `added_to_profile`
- Mutations: `saveTrack`, `unsaveTrack`, `toggleAddToProfile`

### 5. Preview audio component: `PreviewPlayer.tsx`
- Encapsulates the seek-to-start, stop-at-15s logic
- `controlsList="nodownload"`, `onContextMenu={prevent}`
- Visual progress bar showing only the 15s window

### 6. Download enforcement
- Download button only renders if: `allow_downloads === true` AND user has purchase record
- Triggers `fetch(audio_url) → blob → download` (forces save instead of inline playback)

### 7. Files

**New**:
- `supabase/migrations/<ts>_music_saves_and_track_settings.sql`
- `src/hooks/useMusicLibrary.ts`
- `src/components/music/PreviewPlayer.tsx`
- `src/components/music/SavedMusicSection.tsx`

**Modified**:
- `src/components/music/ExclusiveTrackCard.tsx` — full redesign
- `src/components/music/ExclusiveMusicSection.tsx` — grid, new upload fields, remove visitor gate
- `src/hooks/useExclusiveMusic.ts` — add new track fields to interface
- `src/integrations/supabase/types.ts` — auto-regenerated
- `src/pages/Profile.tsx` — mount `SavedMusicSection`

### 8. Verification
- After build: open `/profile` as visitor → confirm tracks render, preview plays for 15s and stops, Buy CTA visible
- As owner: upload track with `allow_downloads=true`, set preview start, confirm settings persist
- Simulate purchase row in DB → confirm Save/Add to Profile/Download all appear → confirm Add to Profile causes track to render in `SavedMusicSection` on owner's profile with original artist attribution

