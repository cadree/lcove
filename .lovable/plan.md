

# Fix Custom Role Proposals Not Creating Separate Roles

## Problem
When a custom role proposal (e.g., "Gaffer") is accepted, it should become its own separate role rather than being attached to an existing role like "Director." The backend logic was added previously but has two issues that may prevent it from working correctly.

## Root Cause Analysis

The custom role creation logic in `useProjects.ts` already exists and appears correct. However, there are two potential issues:

1. **Missing cache invalidation**: After accepting a custom role, the `onSuccess` handler invalidates `['projects']` but not `['my-projects']`. This means the owner's project list may not refresh, so the newly created role won't appear until a full page reload.

2. **Submission fallback blocks proposals when all roles are locked**: The `handleCustomRoleSubmit` function in `ProjectDetail.tsx` requires at least one unlocked role to exist (`project.roles?.find(r => !r.is_locked)`). If all defined roles are filled and locked, custom role proposals can't be submitted at all -- even though the whole point of proposing a custom role is to create a new one.

## Changes

### 1. Fix `ProjectDetail.tsx` -- Remove dependency on existing open roles for custom proposals

Currently, custom role proposals piggyback on the first open role's ID just to satisfy the `role_id` foreign key. Instead, we should still use any available role as a placeholder, but also allow submission even when all roles are locked (since the proposal will create its own role upon acceptance). Change the fallback to use ANY role (locked or not) since it's just a temporary placeholder.

### 2. Fix `useProjects.ts` -- Add missing cache invalidation

Add `['my-projects']` to the invalidation list in the `reviewApplication` `onSuccess` handler so the owner sees the new role immediately after accepting.

## Technical Details

### File: `src/components/projects/ProjectDetail.tsx` (lines 103-114)
- Change `project.roles?.find(r => !r.is_locked)` to `project.roles?.[0]` so custom proposals can be submitted even when all existing roles are filled
- Update the error message to "No roles defined for this project" (edge case where project has zero roles)

### File: `src/hooks/useProjects.ts` (line 698)
- Add `queryClient.invalidateQueries({ queryKey: ['my-projects'] })` to ensure the owner's project view refreshes with the new role
