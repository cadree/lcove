

# Project Groupchat Upgrades -- Implementation Plan

This is a large, multi-part feature set. To keep it manageable and shippable, I'll break it into phases with clear deliverables.

---

## Phase 1: Database Schema (Migration)

Create a new `project_checklist_items` table and an `item_suggestions` table to support the structured checklist and suggestion systems.

### New Tables

**`project_checklist_items`**
- `id` (uuid, PK)
- `project_id` (uuid, FK to projects, NOT NULL)
- `category` (text, NOT NULL) -- 'props', 'equipment', 'other'
- `name` (text, NOT NULL)
- `assigned_user_id` (uuid, nullable, FK concept)
- `status` (text, default 'unclaimed') -- 'unclaimed', 'claimed', 'completed'
- `notes` (text, nullable)
- `created_by` (uuid, NOT NULL)
- `created_at`, `updated_at` (timestamptz)
- RLS: participants of the project's groupchat can SELECT; owner can INSERT/UPDATE/DELETE; any participant can UPDATE own assignment

**`project_item_suggestions`**
- `id` (uuid, PK)
- `project_id` (uuid, NOT NULL)
- `suggested_by` (uuid, NOT NULL)
- `category` (text, NOT NULL)
- `name` (text, NOT NULL)
- `notes` (text, nullable)
- `status` (text, default 'pending') -- 'pending', 'approved', 'denied'
- `reviewed_by` (uuid, nullable)
- `created_at` (timestamptz)

Enable realtime on both tables.

---

## Phase 2: Fix Moodboard and File Previews

### File: `src/components/messages/ProjectCommandCenter.tsx`

**YouTube**: Change from link-only thumbnail to an inline `<iframe>` embed that actually plays. Use `https://www.youtube.com/embed/{id}` with `allowFullScreen`. Keep the thumbnail as fallback with a play button that swaps to iframe on click.

**PDFs**: Replace the plain FileText icon with a Google Docs Viewer iframe preview:
```
https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}
```
Render inside a small aspect-ratio container. Click opens full URL in new tab.

**Images**: Already working -- verify storage URLs are from the public `media` bucket (they are). No changes needed.

**Video in chat messages**: The `ChatView.tsx` already renders `<video>` for `media_type === 'video'`. The `MessageComposer` already accepts `video/*` in the file input. This is already functional.

---

## Phase 3: Structured Checklist System

### New Hook: `src/hooks/useProjectChecklist.ts`
- `useProjectChecklist(projectId)` -- query all checklist items for a project
- `useCreateChecklistItem()` -- owner-only mutation
- `useClaimChecklistItem()` -- any participant can claim unclaimed items
- `useCompleteChecklistItem()` -- assigned user can mark complete
- `useDeleteChecklistItem()` -- owner-only
- Realtime subscription on `project_checklist_items`

### New Component: `src/components/messages/ProjectChecklist.tsx`
- Renders inside `ProjectCommandCenter` under Equipment and Props sections
- Groups items by `category` (Props, Equipment, Other)
- Each item shows: name, status badge, assigned user avatar+name, notes
- "Take Responsibility" button on unclaimed items
- "Mark Complete" button for the assigned user
- Owner sees delete/edit controls
- "+ Suggest Item" button for non-owner members (opens a small inline form)

### New Hook: `src/hooks/useItemSuggestions.ts`
- `useItemSuggestions(projectId)` -- owner sees pending suggestions
- `useSuggestItem()` -- any member can suggest
- `useReviewSuggestion()` -- owner approves/denies; on approve, auto-creates checklist item

---

## Phase 4: Owner Timeline Editing

### File: `src/components/messages/ProjectCommandCenter.tsx`
- When `isOwner` is true, show edit icons next to Timeline and Milestones sections
- Clicking edit opens an inline form or small dialog to:
  - Edit start/end dates (date pickers)
  - Add new milestones (title + due date)
  - Change milestone status (dropdown)
- Uses existing `useProjectMilestones` mutations (`useCreateMilestone`, `useUpdateMilestoneStatus`) from `src/hooks/useProjectMilestones.ts`
- Timeline date changes update the project record directly via a new `useUpdateProjectTimeline` mutation in `useProjectChatData.ts`
- On save, send a system message to the groupchat: "Timeline updated by [Owner]"
- Invalidate `project-chat-data` query on success

---

## Phase 5: Fix "Unknown" Profile Name Bug

### File: `src/components/messages/ChatView.tsx` (line 335)
- Current code shows `msg.profile?.display_name || 'Unknown'`
- The `useMessages` hook already joins `profiles_public` -- the issue is likely that some users don't have a `profiles` row or `display_name` is null
- Fix: Change fallback from `'Unknown'` to a more descriptive fallback that tries the participant list profile too
- In `useMessages.ts`, if `profiles_public` returns null for display_name, fall back to checking `conversation_participants` profile data
- Also ensure `handle_new_user()` trigger creates a profile row on signup (already exists in DB functions)

---

## Phase 6: Presence Indicators in Groupchat Header

### File: `src/components/messages/ChatView.tsx`
- Already imports `usePresence` and `OnlineIndicator`
- For project chats, add a small row of participant avatars with online indicators below the header
- Show online count: "3 of 7 online"
- Use existing `PresenceProvider` and `usePresence` hook

---

## Phase 7: Notification Improvements

### File: `src/hooks/useProjectChecklist.ts`
- On checklist claim/complete, insert into `notifications` table for relevant users
- On suggestion submitted, notify owner
- On suggestion approved/denied, notify suggester

### File: `src/components/messages/ProjectCommandCenter.tsx`
- On milestone status change, insert notification for all participants
- On timeline edit, insert notification for all participants

This uses the existing `notifications` table and the existing `NotificationBell` component picks them up automatically.

---

## Files Changed Summary

### New files (4):
1. `src/hooks/useProjectChecklist.ts` -- Checklist CRUD + realtime
2. `src/hooks/useItemSuggestions.ts` -- Suggestion system
3. `src/components/messages/ProjectChecklist.tsx` -- Checklist UI
4. Database migration SQL -- New tables + RLS + realtime

### Modified files (3):
1. `src/components/messages/ProjectCommandCenter.tsx` -- YouTube iframe embeds, PDF viewer, checklist integration, owner edit controls for timeline/milestones
2. `src/components/messages/ChatView.tsx` -- Presence bar for group chats, fix "Unknown" fallback
3. `src/hooks/useProjectChatData.ts` -- Add `useUpdateProjectTimeline` mutation

### Existing functionality preserved:
- Video uploads already work via MessageComposer
- Presence system already exists via `usePresence`
- Profile creation trigger already exists (`handle_new_user`)
- Realtime subscriptions for messages/participants already in place

