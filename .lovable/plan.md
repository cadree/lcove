

## Audit Findings — Why the UI Doesn't Auto-Fill

### What's actually broken

I tested the edge function directly with the user's exact Apple Music URL. **It works** — returns `artist_name: "Lil Keed"` and a valid image URL. So the extraction itself is fine. The bug is **100% client-side**.

**Root cause (Bug 1):** In `fetchArtistData`, every assignment is gated:
```ts
if (data.artist_name && !displayName) setDisplayName(data.artist_name);
if (data.image_url && !artistImage) setArtistImage(data.image_url);
```
The user's saved `music_profile` row already has `display_name` set to the URL itself (`"https://music.apple.com/us/album/..."`). When the dialog opens, `useEffect` populates `displayName` with that string → the guard `!displayName` is `false` → **name never updates**. Same trap blocks image, genres, tracks, albums. The toast "Artist info extracted!" still fires, so it looks like nothing happened.

**Bug 2 — Stale closure:** `useCallback` dependencies make every paste capture old state. Combined with the truthy guards, this silently swallows updates.

**Bug 3 — Apple Music album pages return empty tracks/genres:** Apple's HTML for `/album/` URLs doesn't expose track listings in scrapeable meta tags. Edge function returns `top_tracks: []`. Need a client-side fallback: at minimum, save the album itself (we know its name from the URL slug + we have its cover art).

**Bug 4 — No error visibility:** Failures are swallowed. No console logs, no inline error.

---

## Fix Plan

### 1. `src/components/music/ConnectMusicDialog.tsx`
- **Remove the truthy guards** in `fetchArtistData`. Always overwrite when extraction returns data, UNLESS the current value was manually typed by the user. Track this with a `userEditedFields` ref.
- **Detect "URL-as-name" corruption**: if `displayName` starts with `http`, treat it as empty and overwrite.
- **Drop `useCallback` deps** — use a ref-based extractor so paste always uses fresh state and never goes stale.
- **Add debounce (400ms)** so typing/pasting fires extraction once URL stabilizes (instead of on every keystroke).
- **Add console.log breadcrumbs**: detected URL, request payload, raw response, what got applied.
- **Inline error UI**: show a red helper text under the link row when extraction fails or returns nothing useful.
- **Apple Music album fallback**: if URL contains `/album/<slug>/`, parse the slug → push to `albums` with cover art from `image_url` even when edge function returns `albums: []`.
- **Spotify track/album fallback**: same treatment for `/album/` and `/track/` URLs.

### 2. `src/hooks/useMusicProfile.ts` (one-line fix)
- Stop saving the URL into `display_name`. Currently the legacy save path can write the raw URL when artist name extraction fails. Add a guard: if `display_name` looks like a URL, save `null` instead and let the user fill it.

### 3. One-time data heal
- On dialog mount, if the existing `display_name` is a URL, clear it locally so extraction can repopulate it with the real artist name.

### 4. Test in preview
- Open dialog on `/profile`, paste the same Apple Music URL, confirm: Artist Name → "Lil Keed", image populates, album appears in the Albums strip, console shows the trace.

---

## Files Modified
- `src/components/music/ConnectMusicDialog.tsx` — extraction logic, fallbacks, error UI, debug logs
- `src/hooks/useMusicProfile.ts` — guard against URL-as-name persistence

No DB migration. No edge function changes (it already works).

