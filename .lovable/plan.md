

# Fix Missing Custom Roles from Accepted Proposals

## Problem
The "DANCER" and "hdgd" custom role proposals were accepted, but no new roles were created. The applications still point to the original "DIRECTOR" and "filmer" roles, and those roles have incorrect `slots_filled` counts (DIRECTOR shows 2/1 instead of 1/1). This happened because the applications were accepted before the custom role creation code was deployed.

## Two-Part Fix

### Part 1: Data Repair via Database
Run a one-time data fix to:
- Create the missing "DANCER" and "hdgd" roles for the project
- Reassign the two accepted applications to their correct new roles
- Fix the inflated `slots_filled` on the DIRECTOR role (reset from 2 to 1)

This will be done via a SQL migration that:
1. Inserts two new `project_roles` rows for "DANCER" and "hdgd" with `slots_filled: 1, slots_available: 1, is_locked: true`
2. Updates each application's `role_id` to point to the corresponding new role
3. Decrements `slots_filled` on the DIRECTOR role back to 1

### Part 2: Add a SECURITY DEFINER Database Function
To prevent any future RLS edge cases, create a database function `accept_custom_role_proposal` that runs with elevated privileges. This function will:
- Accept an application ID and custom role name
- Create the new `project_roles` row
- Reassign the application's `role_id`
- Update the application status to 'accepted'
- Let the existing trigger handle `slots_filled` increment

Then update `useProjects.ts` to call this function via `supabase.rpc('accept_custom_role_proposal', ...)` instead of doing multiple client-side queries. This is more reliable and atomic.

## Technical Details

### Database Migration
```sql
-- 1. Create missing custom roles
-- 2. Reassign applications
-- 3. Fix DIRECTOR slots_filled
```

### New Database Function: `accept_custom_role_proposal`
Parameters: `p_application_id UUID, p_custom_role_name TEXT, p_reviewer_id UUID`
- Validates the application exists and is pending
- Validates the reviewer is the project creator
- Creates new role row
- Reassigns application role_id
- Updates application status to 'accepted' (trigger handles slot increment)
- Returns the new role ID

### File: `src/hooks/useProjects.ts`
- In `reviewApplication` mutation, when a custom role proposal is detected and status is 'accepted', call `supabase.rpc('accept_custom_role_proposal', {...})` instead of the current multi-step client-side logic
- Keep the rest of the flow (group chat, notifications) unchanged

