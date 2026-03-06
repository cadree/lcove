

## Private Client Projects + Client Role Workflow

This is a large feature that adds a professional client-facing layer to the existing project system. Here's the breakdown:

### Database Changes (Migration)

**1. Add columns to `projects` table:**
- `is_private` (boolean, default false) -- toggles private client project mode
- `client_chat_in_production` (boolean, default false) -- "Include Client in Production Chat" toggle

**2. Create `project_clients` table:**
```text
project_clients
├── id (uuid, PK)
├── project_id (uuid, FK → projects)
├── client_user_id (uuid, FK → auth.users)
├── invited_by (uuid)
├── status (text: 'invited', 'accepted', 'removed')
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

**3. RLS policies for `project_clients`:**
- Project owners can INSERT/SELECT/UPDATE/DELETE
- Clients can SELECT their own rows
- Clients can UPDATE their own row (to accept invite)

**4. Update `projects` RLS:**
- The existing public SELECT policy filters out `is_private = true` projects (only show public ones in Browse)
- Private projects visible to creator + clients via separate policy

**5. Create a separate client chat:**
- When a client is invited, auto-create a 1:1 or group conversation with `type = 'client'` (or reuse `type = 'direct'`) between owner and client, linked to the project via a new `client_project_id` column on conversations, or simply tag it with project_id + a `is_client_chat` boolean

Actually, simpler approach: add `is_client_chat` boolean (default false) to `conversations` table. When owner invites a client, create a conversation with `project_id`, `is_client_chat = true`, and add owner + client as participants.

### Frontend Changes

**1. `CreateProjectDialog.tsx` -- Add visibility toggle:**
- New "Project Visibility" section with Public / Private Client toggle
- When Private is selected, hide community-facing options (expected outcome chips)
- Pass `is_private` to `createProject`

**2. `EditProjectDialog.tsx` -- Add visibility + client toggle:**
- Visibility toggle (Public ↔ Private)
- "Include Client in Production Chat" switch

**3. `useProjects.ts` -- Update queries:**
- `projects` query (Browse): filter `is_private = false`
- `myProjects` query: show all (including private)
- `createProject`: pass `is_private`, `client_chat_in_production`
- Add `inviteClient` mutation (insert into `project_clients`, create client chat, send notification)

**4. `Projects.tsx` -- Add "Client Projects" tab:**
- New tab visible to authenticated users showing their private projects (as creator) and projects where they are a client
- Separate section with Lock icon

**5. New component: `ClientInviteDialog.tsx`:**
- Owner can search for users and send client invites
- Shows current clients list with status

**6. `ProjectDetail.tsx` -- Client-aware views:**
- If current user is a client: show simplified read-only dashboard (title, progress, confirmed roles, supplies, props, files, timeline) -- hide applications tab, updates posting, budget editing, role applications
- If current user is owner: show "Clients" tab with invite button, client list, "Include in Production Chat" toggle
- Client gets a "Client Chat" button that opens their private chat with the owner

**7. New component: `ClientDashboardView.tsx`:**
- Simplified project view component for clients
- Shows: title, progress bar, confirmed team roles (filled only), supplies list, props list, files/deliverables, timeline
- Clean, professional layout optimized for client awareness

**8. `ProjectCard.tsx`:**
- Show a "Private" badge/lock icon on private projects
- Fix the share URL (currently still using Supabase function URL)

### Notification Flow
- When owner invites a client: in-app notification + email via existing notification system
- When client accepts: owner gets notified
- Client chat messages use existing `send-dm-notification` flow

### Summary of Files to Create/Modify

| Action | File |
|--------|------|
| Migration | Add `is_private`, `client_chat_in_production` to projects; create `project_clients` table; add `is_client_chat` to conversations |
| Create | `src/components/projects/ClientInviteDialog.tsx` |
| Create | `src/components/projects/ClientDashboardView.tsx` |
| Modify | `src/hooks/useProjects.ts` (queries, mutations, client logic) |
| Modify | `src/components/projects/CreateProjectDialog.tsx` (visibility toggle) |
| Modify | `src/components/projects/EditProjectDialog.tsx` (visibility + client toggle) |
| Modify | `src/components/projects/ProjectDetail.tsx` (client view, client tab) |
| Modify | `src/components/projects/ProjectCard.tsx` (private badge, fix share URL) |
| Modify | `src/pages/Projects.tsx` (Client Projects tab) |

