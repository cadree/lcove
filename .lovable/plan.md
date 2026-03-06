

## Audit Findings

### 1. OG Image Preview: Fundamentally broken

**Root cause**: The Supabase gateway **forces `Content-Type: text/plain`** on all edge function responses, regardless of what the function sets. I confirmed this by calling the edge function directly -- the response body contains correct HTML with the right project title, image, and description, but the gateway returns `Content-Type: text/plain`. Social crawlers (iMessage, Facebook, etc.) ignore OG tags in plain text responses.

This means the entire edge-function-as-share-URL strategy cannot work. No amount of header manipulation inside the function will fix this -- it's a gateway-level override.

**Additionally**, the `index.html` `og:image` uses a relative path (`/favicon.png`) which crawlers can't resolve.

**Fix**: 
- Revert share URLs back to clean `https://etherbylcove.com/project/{id}` URLs everywhere (Copy Link, navigator.share, SMS, Email)
- Update `index.html` OG tags to use absolute URLs (`https://etherbylcove.com/favicon.png`) so at minimum the default ETHER branding shows correctly in previews
- The edge function can remain as-is for future use if a proxy/CDN is added later

### 2. Guest Application Flow: Working correctly

- `guest_role_applications` table exists with proper RLS: anonymous INSERT allowed, creator-only SELECT/UPDATE
- Guest form fields (name, email, portfolio, message) render correctly for unauthenticated users
- Success dialog shows "Create Profile" and "Continue as Guest" buttons
- `AccessGate` correctly marks `/project/` routes as public

### 3. "View Full Details" button: Works but has auth caveat

The button opens `ProjectDetail` as a sheet, which uses `useProjectApplications`, `useProjectAttachments`, `useProjectUpdates`, and `useProjectMilestones` hooks. These all query with the Supabase client. For unauthenticated users, the `projects` table has a public SELECT policy (`Anyone can view open projects`), so basic data loads. However, the attachment/update queries may return empty for guests (which is acceptable -- those are workspace features).

### 4. Share URL in clipboard/text: Shows ugly Supabase URL

Currently `handleShare` and `handleCopy` in both `PublicProjectPage.tsx` and `ProjectDetail.tsx` copy the edge function URL (`https://wjbyvlgsxscwukkolehg.supabase.co/functions/v1/share-page/p/...`). This is ugly AND broken (doesn't produce previews). Must revert to clean URLs.

## Planned Changes

### `index.html`
- Change `og:image` from `/favicon.png` to `https://etherbylcove.com/favicon.png` (absolute URL)
- Change `twitter:image` similarly
- Change `og:url` and `canonical` from `https://lcove.lovable.app` to `https://etherbylcove.com`

### `src/pages/PublicProjectPage.tsx`
- Remove `ogUrl` variable entirely
- Change all share actions (Copy, Share, SMS, Email) to use `cleanUrl` (`https://etherbylcove.com/project/${projectId}`)

### `src/components/projects/ProjectDetail.tsx`
- Same change: remove `ogUrl`, use clean URL for all share actions

### No changes needed
- Edge function (`share-page/index.ts`) -- keep as-is for future proxy use
- Database/RLS -- guest applications work correctly
- `AccessGate` -- public routes configured correctly
- Guest form UI -- fields and success dialog are correct

