

## Root cause

`navigator.share()` fails silently or throws in many places:
- **In the Lovable preview iframe** (where the user is testing) `navigator.share` is blocked by the iframe's permissions policy → throws `NotAllowedError` immediately, never opening the system sheet.
- **On desktop browsers** (Firefox, most Chrome desktop) `navigator.share` is `undefined` → some handlers do nothing.
- **Some handlers have NO fallback** (`FeedPost`, `ContentDetailDialog`, `PostDetailModal` partially) so the button appears broken.
- **Inconsistent URLs** — some use `window.location.href` (which on the preview is a `lovableproject.com` URL, not shareable), others correctly use `etherbylcove.com`.

The `ProjectCard` already has the correct multi-tier fallback (native → clipboard → execCommand → prompt) — I'll extract that into a shared utility and use it everywhere.

## Plan

### 1. New shared utility `src/lib/shareLink.ts`
A single `shareLink({ title, text, url })` function with the proven 4-tier fallback:
1. Try `navigator.share` (wrapped in try/catch — swallow `AbortError` only, fall through on `NotAllowedError`)
2. Try `navigator.clipboard.writeText`
3. Try legacy `document.execCommand('copy')` via hidden textarea
4. `window.prompt('Copy this link:', url)`
Always shows a toast on success / "Link copied!" / failure.

### 2. Standardize share URLs to canonical domain
Always build URLs as `https://etherbylcove.com/{type}/{id}`:
| Surface | Type |
|---|---|
| Event | `/event/:id` |
| Project | `/project/:id` |
| Profile | `/profile/:userId` |
| Post | `/profile/:userId?post=:postId` |
| Client portal | `/client/:token` |
| Cinema content | `/cinema?content=:id` (current Cinema route) |

### 3. Replace every `handleShare` to use `shareLink()`
Files updated:
- `src/components/feed/FeedPost.tsx` — currently fails completely on desktop; uses `window.location.href`
- `src/components/cinema/ContentDetailDialog.tsx` — no fallback at all
- `src/components/profile/PostDetailModal.tsx` — silent on cancel/desktop
- `src/components/calendar/EventDetailDialog.tsx` — keep multi-channel menu (Twitter/SMS/WhatsApp/FB) but route the "Native/Copy" path through `shareLink`
- `src/pages/EventDetail.tsx`
- `src/pages/EventsDashboard.tsx`
- `src/components/profile/ProfileEventsDashboard.tsx`
- `src/pages/PublicEventPage.tsx`
- `src/pages/PublicProjectPage.tsx`
- `src/components/projects/ProjectDetail.tsx` (the share menu's native button)
- `src/components/projects/ProjectCard.tsx` — refactor to call the new util (remove the inlined copy)
- `src/components/projects/ClientInviteDialog.tsx` — `handleSystemShare` uses util

### 4. Verify the OG/share-page edge function still works
`share-page` already supports `e/p/u/c` types and returns proper OG tags for crawlers + a 302 for humans. No change needed there — confirm the branded URLs (`etherbylcove.com/event/:id` etc.) are what gets shared, since the static OG tags in `index.html` + per-route updates handle previews on the live domain.

### 5. Test
1. **In the preview iframe**: tap Share on a project card → toast says "Link copied!" (native share blocked → falls back to clipboard).
2. **On desktop browser** at the published URL: share buttons on Feed post, Cinema content, Post modal, Event dialog, Project detail, Profile event card — each copies link & shows toast.
3. **On mobile Safari** at `etherbylcove.com`: same buttons open the native share sheet.
4. Paste a copied event/project/profile link into iMessage / Slack → preview card renders (validates `share-page` OG path is intact).
5. Cancel a native share sheet → no error toast (AbortError swallowed).

