

# Fix Project Detail View for Applicants & Public Viewers

## Problem Summary

The project detail UI already renders all sections for all viewers. However, **milestone data is invisible to non-members** because the RLS policy restricts SELECT to only project creators and accepted collaborators. Applicants considering a project cannot see the timeline/milestones, which is critical context for applying.

## Changes Required

### 1. Database Migration: Relax Milestones RLS

The current milestones SELECT policy only allows creators and accepted applicants. We need to allow all authenticated users to view milestones for any project (milestones are non-sensitive project planning data).

**SQL Migration:**
- Drop the existing restrictive SELECT policy on `project_milestones`
- Create a new policy allowing all authenticated users to SELECT milestones

This aligns with how `project_attachments` and `project_updates` already work (authenticated users can view all).

### 2. No UI Changes Needed

After auditing `ProjectDetail.tsx` (lines 1-691), all detail sections are already rendered for all viewers:
- Description, budget, resources, timeline, milestones, deliverables, outcomes -- all render unconditionally based on data presence
- The "Files" tab is visible to everyone; upload controls are correctly gated behind `isCreator`
- The "Applications" tab is correctly hidden from non-creators
- The "Updates" tab shows updates to everyone; posting is gated behind `isCreator`
- Delete buttons on attachments are gated behind `isCreator`
- Progress slider is editable only by creator; read-only bar shown to others

The only reason applicants can't see milestones is the database-level RLS block. Once that's fixed, the existing UI will display all data correctly.

### Technical Details

**Files to modify:** None (UI is correct)

**Database migration:** One migration to update `project_milestones` SELECT policy

```text
DROP POLICY "Project participants can view milestones" ON public.project_milestones;

CREATE POLICY "Authenticated users can view milestones"
  ON public.project_milestones FOR SELECT
  TO authenticated
  USING (true);
```

This is a minimal, targeted fix. The milestone data (title, phase, due date, status) is not sensitive -- it's project planning information that helps applicants understand the scope.

