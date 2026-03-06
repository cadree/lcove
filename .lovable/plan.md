

## Problem

The shared URL `https://etherbylcove.com/project/{id}` is a client-side SPA route. When iMessage/social platforms crawl it, they get the static `index.html` which has the default ETHER bear logo and generic "ETHER - Creative Community OS" title. The `share-page` edge function has correct project-specific OG tags but is not being used as the share URL.

## Solution

Use the edge function URL as the share URL. The edge function already:
- Serves correct OG meta tags (project title, cover image, description)
- Redirects real users to `https://etherbylcove.com/project/{id}` via `<meta http-equiv="refresh">`

This means crawlers see the right preview, and humans land on the clean URL.

## Changes

### `src/components/projects/ProjectDetail.tsx`
- Change share URL from `https://etherbylcove.com/project/${project.id}` to the edge function URL: `` `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/share-page/p/${project.id}` ``

### `src/pages/PublicProjectPage.tsx`
- Same change for the share URL on the public project page

The "Copy Link" action will also use this URL since it's what generates the preview. Users clicking the link get instantly redirected to the clean `etherbylcove.com` URL.

