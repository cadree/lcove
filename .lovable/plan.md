

# Project Groupchat: Creative Command Center

## Overview
Transform project group chats into full "Creative Operating System" rooms with auto-creation on project creation, auto-member addition on acceptance, and a rich Project Overview Panel embedded directly in the chat interface.

---

## Part 1: Auto-Create Project Groupchat on Project Creation

**Current state**: Groupchat is only created when the first application is accepted (in `reviewApplication` mutation, lines 600-632 of `useProjects.ts`).

**Change**: Move groupchat creation into `createProject` mutation so it happens immediately.

### File: `src/hooks/useProjects.ts`
- In `createProject.mutationFn` (after project + roles + milestones are created, ~line 255):
  - Insert a new `conversations` row with `type: 'group'`, `name: project.title`, `project_id: project.id`, `visibility: 'private'`
  - Add creator as participant with `role: 'owner'`, `project_role_name: 'Project Creator'`
  - Add a unique constraint check (query first to prevent duplicates on retry)

### Database: Add unique constraint
- Migration: `ALTER TABLE conversations ADD CONSTRAINT conversations_project_id_unique UNIQUE (project_id)` (partial unique index where project_id IS NOT NULL)

---

## Part 2: Auto-Add Members on Acceptance (already works, minor fixes)

**Current state**: The `reviewApplication` mutation already adds accepted users to the project groupchat and sends a welcome message. It also checks for duplicates.

**Changes needed**:
- Remove the "create groupchat" logic from `reviewApplication` since it now exists at project creation time. Keep only the "find existing + add participant" logic as a safety fallback.
- Ensure the system message format matches: "Name joined the project as Role"

---

## Part 3: Project Overview Panel (Creative Command Center)

**Current state**: ChatView has a basic collapsible project info panel (lines 276-336) showing only description, timeline, and team members.

### New Component: `src/components/messages/ProjectCommandCenter.tsx`
A rich, collapsible panel displayed at the top of project chats containing:

**Sections (all read-only for non-owners, editable by owner):**

1. **Cover Image** -- full-width banner from `project.cover_image_url`
2. **Vision / Description** -- project description text
3. **Moodboard Preview Strip** -- thumbnail grid (first 6 items) from `project_attachments`:
   - Images rendered inline
   - PDFs via Google Docs Viewer iframe
   - YouTube links auto-embedded
   - Click opens full file in new tab
4. **Venue / Location** -- from `project.venue`
5. **Equipment** -- from `project.equipment_needed`
6. **Props / Vendors** -- from `project.props_needed`, `project.vendors_needed`
7. **Sponsorship** -- from `project.sponsorship_needed`
8. **Milestones Timeline** -- from `project_milestones` table, with countdown to next due date
9. **Deliverables List** -- from `project.deliverables` JSON array
10. **Budget Summary** -- from `project.total_budget`, `project.budget_range`
11. **Roles** -- filled and open slots from `project_roles`
12. **Countdown** -- days until next milestone or `timeline_start`

**Data hooks needed**: Reuse `useProjectAttachments`, `useProjectMilestones`, and fetch full project details with roles.

### File: `src/components/messages/ChatView.tsx`
- Replace the existing basic project info panel (lines 276-336) with the new `ProjectCommandCenter` component
- Pass `conversationId`, `projectId`, and `isOwner` props
- Panel is collapsible but **visible by default** on first load
- Smooth scroll transition between panel and messages

---

## Part 4: Moodboard Rendering Inside Chat

### In `ProjectCommandCenter.tsx`:
- Query `project_attachments` for the project
- Render a thumbnail grid:
  - **Images**: `<img>` with object-cover, click to open in new tab
  - **PDFs/DOCs**: Google Docs Viewer thumbnail (`https://docs.google.com/gview?url=...&embedded=true`)
  - **YouTube links**: Extract video ID, show embed thumbnail, click to play
- Show first 6 items with "View all" expand option

---

## Part 5: Permissions Logic

### In `ProjectCommandCenter.tsx`:
- `isOwner = project.creator_id === user?.id`
- Owner sees edit icons next to each section (inline edit dialogs)
- Members see read-only view
- Non-members cannot access the chat at all (existing RLS handles this)

---

## Part 6: Real-time Updates

### Already in place:
- `useConversations` subscribes to `postgres_changes` on `messages` table
- Conversation participant changes trigger refetch

### Additional:
- Add realtime subscription for `conversation_participants` changes in the ChatView so team list updates live when new members join

---

## Part 7: Hook for Full Project Chat Data

### New hook: `src/hooks/useProjectChatData.ts`
Consolidates all data needed for the command center:
- Project details (with roles)
- Project attachments (moodboard)
- Project milestones
- Single hook that ChatView's ProjectCommandCenter can consume

---

## Technical Summary

### New files:
1. `src/components/messages/ProjectCommandCenter.tsx` -- Rich project overview panel
2. `src/hooks/useProjectChatData.ts` -- Consolidated data hook for project chat

### Modified files:
1. `src/hooks/useProjects.ts` -- Add groupchat creation to `createProject`, simplify `reviewApplication`
2. `src/components/messages/ChatView.tsx` -- Replace basic info panel with ProjectCommandCenter, default-open, add realtime for participants

### Database changes:
1. Add unique partial index on `conversations.project_id` (WHERE project_id IS NOT NULL) to enforce one groupchat per project

