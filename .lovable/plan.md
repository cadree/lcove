

## Problem

The share button generates an edge function URL (`https://...supabase.co/functions/v1/share-page/p/{id}`) that iMessage treats as a downloadable text document instead of rendering a link preview. Recipients see raw HTML source code rather than a clickable link with OG metadata.

## Root Cause

iMessage and some other platforms don't properly unfurl Supabase edge function URLs. The `/functions/v1/` path pattern is not recognized as a standard webpage, so the HTML response gets displayed as a text file attachment instead of being parsed for OG tags.

## Solution

Change the shared URL to the **public app URL** (`https://lcove.lovable.app/project/{id}`) instead of the edge function URL. This ensures:
- Recipients see a clean, recognizable link
- The link is clickable and functional for all users
- No raw HTML is displayed as a text document

For OG previews specifically, keep the edge function available but use it only where platforms support it (e.g., the "More Options" native share could still use it).

## Changes

### `src/components/projects/ProjectDetail.tsx`
- Change the share URL from the edge function URL to the published app URL: `https://lcove.lovable.app/project/${project.id}`
- Update all share actions (Copy Link, Email, SMS, native share) to use this clean URL

### `src/pages/PublicProjectPage.tsx`
- If there are any share URLs here, update them consistently to use the public app URL

