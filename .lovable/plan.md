

## Guest Project Viewing and Application System

### Current State

- **Project data** is already publicly readable (RLS allows anon SELECT for non-draft projects)
- **Project roles** are publicly readable for open/in_progress/completed projects
- **Creator profile** fetch fails for anon users because `profiles_public` view uses `security_invoker = on`, which requires authentication on the underlying `profiles` table
- **Applying** requires authentication (`project_applications` INSERT needs `auth.uid()`)
- The "Apply" button currently redirects unauthenticated users to `/auth`

### Plan

#### 1. Database: `guest_role_applications` table

New table for unauthenticated applicants:

```
guest_role_applications
├── id (uuid, PK)
├── project_id (uuid, FK → projects)
├── role_id (uuid, FK → project_roles)
├── name (text, NOT NULL)
├── email (text, NOT NULL)
├── portfolio_link (text, nullable)
├── message (text, nullable)
├── status (text, default 'pending')
├── created_at (timestamptz)
```

RLS policies:
- **Anon INSERT** with `true` (public submission)
- **SELECT** for project creators only (`creator_id = auth.uid()`)
- **UPDATE** for project creators only (to review)

#### 2. Database: Public creator profile function

Create a `SECURITY DEFINER` function `get_public_creator_profile(creator_user_id uuid)` that returns `display_name` and `avatar_url` — callable by anon users without hitting the profiles RLS.

#### 3. Edge Function: `notify-guest-application`

Handles two emails via Resend:
- **To guest**: "Application Received" confirmation with project name and role
- **To project owner**: "New Guest Application" notification with applicant details and link to review

#### 4. UI: Update `PublicProjectPage.tsx`

Major changes to the apply section:

- **When not logged in**: Show inline guest application form (name, email, portfolio link, message) instead of redirecting to `/auth`
- **When logged in**: Keep existing authenticated flow
- Use the `get_public_creator_profile` RPC instead of querying `profiles_public` directly (fixes creator display for anon users)

#### 5. UI: Post-submission success dialog

After a guest submits an application, show a modal:

```
"Application submitted!
Want to collaborate with the team in real time?
Create your Ether profile to join the project workspace."

[Create Profile]  [Continue as Guest]
```

- "Create Profile" → `/auth?redirect=/project/{projectId}`
- "Continue as Guest" → dismiss dialog

#### 6. Security

- Guest applications are write-only for anon (can't read others' applications)
- No sensitive data exposed (only name/email/portfolio stored)
- Rate limiting via edge function (optional, can add later)
- Only project creators can view/manage guest applications

### File Changes Summary

| File | Change |
|------|--------|
| Migration SQL | Create `guest_role_applications` table + RLS + `get_public_creator_profile` function |
| `supabase/functions/notify-guest-application/index.ts` | New edge function for guest email notifications |
| `src/pages/PublicProjectPage.tsx` | Guest application form, success dialog, fix creator fetch |

