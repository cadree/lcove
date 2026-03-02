

## Plan: Fix Share Buttons + Add Rich Open Graph Link Previews

### Part 1: Fix Broken Share Buttons

**Problem**: The share buttons in "My Events" (ProfileEventsDashboard) and EventsDashboard use the old sharing pattern without the multi-layered fallback chain, and they link to `/calendar?event=` instead of the public `/event/` route.

**Fix** (3 files):
- `src/components/profile/ProfileEventsDashboard.tsx` -- Update `handleShare` to use `/event/${event.id}` URL and the standard fallback chain (try `navigator.share`, then `clipboard.writeText`, then `window.prompt`)
- `src/pages/EventsDashboard.tsx` -- Same fix as above
- `src/pages/PublicEventPage.tsx` -- Apply the same fallback chain to `handleShare` and `handleCopy`

---

### Part 2: Rich Open Graph (OG) Link Previews

**Challenge**: This is a client-side React SPA. Social crawlers (iMessage, Discord, X, Facebook) do NOT execute JavaScript, so they can't see dynamically-rendered meta tags. The only solution is a server-rendered HTML response.

**Approach**: Create a backend function called `share-page` that:
1. Receives a request like `/share-page/e/{eventId}` or `/share-page/p/{projectId}`
2. Fetches entity data from the database
3. Returns a full HTML page with correct OG meta tags
4. Includes a JavaScript redirect so real users are sent to the SPA immediately
5. Social crawlers (which don't run JS) get the OG tags they need

**Supported entity types**:
| Type | Path | SPA redirect |
|------|------|-------------|
| Event | `/share-page/e/{id}` | `/event/{id}` |
| Project | `/share-page/p/{id}` | `/project/{id}` |
| Profile | `/share-page/u/{id}` | `/profile/{id}` |

**What the edge function does**:
- Parse the path to determine entity type and ID
- Query the database for the entity's title, description, and image
- Return HTML with proper OG tags (og:title, og:description, og:image, og:url, twitter:card)
- Use a branded default image if no cover image exists (the existing `/favicon.png`)
- For missing/private entities, return generic ETHER branding with no sensitive info leaked
- Include `<meta http-equiv="refresh">` and `<script>window.location.href=...</script>` to redirect real users

**Share URL generation update**:
All share actions across the app will generate URLs pointing to the edge function:
```
https://{supabase-url}/functions/v1/share-page/e/{eventId}
```

This URL is what gets pasted into iMessage, Discord, etc. Crawlers see OG tags; real users get redirected to the SPA.

**Files to update for share URL generation**:
- `src/components/profile/ProfileEventsDashboard.tsx`
- `src/pages/EventsDashboard.tsx`
- `src/pages/PublicEventPage.tsx`
- `src/components/projects/ProjectDetail.tsx`
- `src/components/projects/ProjectCard.tsx`
- `src/pages/PublicProjectPage.tsx`

**New files**:
- `supabase/functions/share-page/index.ts` -- The edge function
- Config entry in `supabase/config.toml` with `verify_jwt = false` (must be publicly accessible)

**OG Image Standard**:
- Use entity cover image directly when available (absolute URL from storage)
- Fall back to `/favicon.png` hosted on the published domain
- All images will be publicly accessible URLs

**Privacy/Security**:
- Only public events (`is_public = true`) and published projects get full OG tags
- Private/draft items get generic "View on ETHER" metadata with the default brand image
- No sensitive data (budgets, participant info) in OG tags

### Technical Details

**Edge function `share-page/index.ts`** structure:
```text
Request --> Parse path (/e/, /p/, /u/)
        --> Query DB for entity
        --> Build OG HTML response
        --> Return with Content-Type: text/html
```

**Helper**: A shared `buildOgHtml()` function that takes title, description, imageUrl, canonicalUrl and returns a complete HTML string with all meta tags + redirect script.

