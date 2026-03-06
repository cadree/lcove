

## Plan: Post-Acceptance Onboarding Flow + Group Chat Notifications

### What Happens Today
When a user is accepted into a project:
1. They get added to the project group chat
2. A join message is posted in the chat
3. An in-app/email/SMS/push notification is sent via `notify-application-accepted`
4. **No calendar sync prompt** -- they never get asked to add project timelines to their calendar
5. **No email reminder opt-in** -- no prompt to enable timeline/milestone reminders
6. **Group chat messages already trigger notifications** to all participants via `useMessages.ts` (in-app + email/SMS via `send-dm-notification`), so that part is working

### What Needs to Change

#### 1. Create an "Accepted Into Project" Dialog Component
A new component `ProjectAcceptedDialog.tsx` that appears when a user taps their "Application Accepted" notification (type `project_invite`). This dialog will contain:

- Congratulations message with project title and role
- **"Add to Calendar"** section using the existing `AddToCalendarButtons` component (Google Calendar, Apple/ICS, Outlook) -- pre-populated with the project's `timeline_start` and `timeline_end`
- **"Turn on Reminders"** toggle to enable email notifications for milestone deadlines and timeline due dates
- **"Open Project Chat"** button that navigates to the group chat
- A "Done" dismiss button

#### 2. Update `NotificationItem.tsx` to Handle `project_invite` Taps
When a user taps a `project_invite` notification, instead of just marking it read, open the new `ProjectAcceptedDialog` with the project data from the notification's `data` field (`project_id`, `role_title`).

#### 3. Update `notify-application-accepted` Edge Function
Add `timeline_start`, `timeline_end`, and `venue` to the notification `data` payload so the client has the info needed to generate calendar events without an extra fetch.

#### 4. Group Chat Notifications (Already Working)
The existing `useMessages.ts` sendMessage mutation already:
- Creates in-app notifications for all participants
- Invokes `send-dm-notification` for email/SMS delivery

No changes needed here -- once a user is added as a participant, they automatically receive notifications for every message.

### Technical Details

**New file**: `src/components/projects/ProjectAcceptedDialog.tsx`
- Accepts `projectId`, `roleTitle`, `open`, `onOpenChange` props
- Fetches project data (title, timeline, venue) via a lightweight query
- Renders `AddToCalendarButtons` with project timeline data
- Includes a notification preferences toggle for email reminders

**Modified files**:
- `src/components/notifications/NotificationItem.tsx` -- Add click handler for `project_invite` type that opens the dialog
- `src/components/notifications/NotificationList.tsx` -- Add state management for the acceptance dialog
- `supabase/functions/notify-application-accepted/index.ts` -- Include timeline data in notification payload
- `src/hooks/useProjects.ts` -- Pass timeline data to the edge function call

