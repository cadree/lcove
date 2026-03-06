

## Fix: Profile Identity Not Showing for Project Creators (and Throughout App)

### Root Cause

The `profiles_public` view has strict filters:
```sql
WHERE show_in_directory = true 
  AND is_private = false
  AND access_status = 'active'
```

Any user who hasn't opted into the directory, has a private profile, or whose access status isn't yet `'active'` will return **no results** from this view. This means their name/avatar shows as "Anonymous" or "?" throughout the app.

The `profiles_public` view is designed for **public discovery** (directory, landing page), not for **identity resolution** between authenticated users.

Per existing RLS policy, authenticated users can already SELECT from the `profiles` table directly — this is the correct table for identity lookups.

### Plan

Switch all **identity resolution queries** (fetching display_name + avatar_url for known user IDs) from `profiles_public` to `profiles`. Keep `profiles_public` only for public-facing discovery contexts (directory search, landing page, unauthenticated views).

**Files to modify (~12 files):**

| File | Context | Change |
|------|---------|--------|
| `src/hooks/useProjects.ts` | Project creator profiles | `profiles_public` → `profiles` |
| `src/hooks/useConversations.ts` | Chat participant names | `profiles_public` → `profiles` |
| `src/hooks/usePostInteractions.ts` | Comment author profiles | `profiles_public` → `profiles` |
| `src/hooks/usePosts.ts` | Feed post author profiles | `profiles_public` → `profiles` |
| `src/hooks/useProjectUpdates.ts` | Update author profiles | `profiles_public` → `profiles` |
| `src/hooks/useCalendar.ts` | Event organizer profile | `profiles_public` → `profiles` |
| `src/hooks/useFriendProfiles.ts` | Friend list profiles | `profiles_public` → `profiles` |
| `src/hooks/useUserBlocks.ts` | Blocked user profiles | `profiles_public` → `profiles` |
| `src/hooks/usePlatformReviews.ts` | Review author profiles | `profiles_public` → `profiles` |
| `src/hooks/useProfile.ts` | Viewing other user profiles | `profiles_public` → `profiles` |
| `src/components/projects/ClientInviteDialog.tsx` | Client user profiles | `profiles_public` → `profiles` |

**Keep `profiles_public` for** (no changes needed):
- `src/hooks/useUserSearch.ts` — directory/discovery search
- `src/components/directory/` — directory listing
- Any unauthenticated/public-facing context

Each change is a simple find-and-replace of the table name in the `.from()` call. No schema or RLS changes needed since authenticated users already have SELECT on `profiles`.

