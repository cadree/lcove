

## Analysis

I tested the `share-page` edge function and confirmed it **does return correct OG tags** (project title "Neon body art", cover image URL, description). However, two issues remain:

### Issue 1: OG Image Not Rendering in Previews

The Supabase gateway is returning `Content-Type: text/plain` despite the edge function setting `text/html`. This prevents social crawlers from parsing the OG meta tags. Additionally, the response includes `Content-Security-Policy: default-src 'none'; sandbox` which some platforms reject entirely.

**Fix**: Add `og:image:width`, `og:image:height`, and `og:image:type` meta tags (iMessage requires these for large image previews). Also ensure the HTML response uses a `new Headers()` object to avoid header stripping.

### Issue 2: Guest Application Flow

The code and RLS are actually correct — the `AccessGate` marks `/project/` routes as public (line 26), the guest form renders for unauthenticated users (`!user`, line 491), and the RLS policy allows anonymous INSERT on `guest_role_applications`. 

However, after testing I believe the issue is that when a guest arrives via the shared link, they land on the page and can see it, but if they click **"View Full Details"** it opens `ProjectDetail` which may trigger auth-dependent queries. Also the share text says "Check out this project" with the raw edge function URL visible, which could confuse users into thinking they need to sign up.

## Planned Changes

### 1. `supabase/functions/share-page/index.ts`
- Add `og:image:width`, `og:image:height`, `og:image:type` meta tags to `buildOgHtml`
- Use `new Headers()` constructor to set Content-Type more explicitly
- Add a `<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>` as a fallback signal for parsers

### 2. `src/pages/PublicProjectPage.tsx`
- Add a CTA banner for non-authenticated users encouraging profile creation (instead of blocking)
- Ensure the "View Full Details" button works gracefully for guests (no auth-wall)

### 3. `src/components/projects/ProjectDetail.tsx`
- No changes needed — the share URL logic from the previous edit is correct

