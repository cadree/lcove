

## Problem

The "View Full Project" button on the public project page navigates to `/projects?open=${projectId}`, which redirects users to the full projects list. The project may not appear in the list due to status filters, loading race conditions, or the user not being authenticated — so the detail sheet never opens.

## Solution

Embed the `ProjectDetail` sheet directly in the `PublicProjectPage`. When "View Full Project" is clicked, open the sheet in-place instead of navigating away. This works for all users (authenticated or not) and eliminates the unreliable redirect flow.

## Changes

### `src/pages/PublicProjectPage.tsx`
1. Import `ProjectDetail` component
2. Add state for `detailOpen` (boolean)
3. Change the "View Full Project" button from `navigate(...)` to `setDetailOpen(true)`
4. Remove the `user &&` gate so non-authenticated users can also view full details
5. Render `<ProjectDetail project={...} open={detailOpen} onClose={...} />` at the bottom
6. Map the fetched project data to match the `Project` type expected by `ProjectDetail`

### Data mapping
The public page fetches project data with `project_roles` included. The `ProjectDetail` component expects a `Project` type with a `roles` field. We need to ensure the shape matches — mapping `project_roles` to `roles` when passing to `ProjectDetail`.

