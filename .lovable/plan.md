

# Create Separate Roles from Custom Role Proposals

## Problem
When an applicant proposes a custom role and the owner accepts it, the application is currently attached to an arbitrary existing role (the first unlocked one). The custom role name is buried in the message text and never becomes a real, visible role. This means:
- The existing role's slot count gets incorrectly incremented
- Other users never see the custom role on the project
- The applicant appears under the wrong role

## Solution

### 1. Update the review logic in `useProjects.ts`

In the `reviewApplication` mutation, detect if the application message contains a custom role proposal (the `[Custom Role Proposal: ...]` prefix). When accepting such an application:

- Parse the custom role name from the message
- Create a new `project_roles` row with that name, `slots_available: 1`, `slots_filled: 1`, `is_locked: true`, and `payout_amount: 0`
- Update the application's `role_id` to point to the newly created role
- Skip the normal slot-filling logic (since the DB trigger `handle_application_accepted` auto-increments slots on the old role, we need to handle this carefully)

### 2. Update the Applications tab UI in `ProjectDetail.tsx`

When the owner views a pending application that contains a custom role proposal:
- Parse and display the proposed role name prominently (e.g., a badge saying "Proposed Role: Sound Engineer")
- Show the actual message content separately (without the prefix)
- The Accept/Reject buttons remain the same

### 3. Handle the database trigger conflict

The existing `handle_application_accepted` trigger automatically increments `slots_filled` on whatever `role_id` the application points to. To avoid double-counting:
- After creating the new role (with `slots_filled: 1` and `is_locked: true`), update the application's `role_id` to the new role BEFORE updating its status to 'accepted'
- This way the trigger fires on the new role (harmlessly incrementing from 1 to 2, but since `slots_available` is 1, `is_locked` stays true)
- Alternative: set `slots_filled: 0` on the new role and let the trigger handle it naturally (cleaner)

The cleaner approach: Create the new role with `slots_filled: 0, slots_available: 1`, then reassign the application's `role_id` to the new role, then update the status to 'accepted'. The trigger will increment `slots_filled` to 1 and lock it automatically.

### 4. Display custom roles in the Roles tab

No changes needed here -- the roles list already renders all `project.roles`, so the newly created role will appear automatically after the query cache is invalidated.

## Technical Details

### Files to modify

**`src/hooks/useProjects.ts`** -- `reviewApplication` mutation:
- Before updating application status, check if `application.message` starts with `[Custom Role Proposal:`
- If yes and status is 'accepted':
  1. Parse the role name from the message
  2. Insert a new row into `project_roles` with `slots_available: 1, slots_filled: 0, payout_amount: 0`
  3. Update the application's `role_id` to the new role's ID
  4. Then proceed with the normal status update (trigger handles the rest)
- Invalidate `['projects']` queries so the new role appears immediately

**`src/components/projects/ProjectDetail.tsx`** -- Applications tab (lines 660-694):
- Add a helper to parse custom role proposals from messages
- When rendering an application, if it's a custom role proposal, show:
  - A "Custom Role" badge with the proposed role name
  - The actual message without the prefix
- No changes to accept/reject flow (the hook handles the logic)

### No database migrations needed
The existing `project_roles` table and `handle_application_accepted` trigger work correctly with this approach. We just need to create the role and reassign before acceptance.

