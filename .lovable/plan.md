

## Problem

Two issues with project sharing:

1. **Wrong domain**: Share URLs use `lcove.lovable.app` instead of the custom domain `etherbylcove.com`
2. **Wrong thumbnail**: The share-page edge function uses the app's default favicon as the fallback OG image instead of the project's cover image. The function fetches `cover_image_url` from the projects table, but if projects don't have that field populated or use a different image field, the default favicon is shown.

## Changes

### 1. Update share URLs to use custom domain

**`src/components/projects/ProjectDetail.tsx`** (line 317)
- Change `https://lcove.lovable.app/project/` → `https://etherbylcove.com/project/`

**`src/pages/PublicProjectPage.tsx`** (line 150)
- Change `https://lcove.lovable.app/project/` → `https://etherbylcove.com/project/`

### 2. Update share-page edge function for correct domain and thumbnail

**`supabase/functions/share-page/index.ts`**
- Change `SITE_URL` from `https://lcove.lovable.app` to `https://etherbylcove.com`
- Update the project query to also select image fields that might contain the project thumbnail (e.g., `image_url`, `thumbnail_url`) alongside `cover_image_url`, and use whichever is available
- This ensures OG previews on iMessage/social platforms show the correct project image

### 3. Verify project image field

Need to check which column stores the project image in the database schema to ensure the edge function queries the right field. Will verify `projects` table schema during implementation.

