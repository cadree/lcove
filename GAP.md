# Projects and collaborations — gap against Cadre's spec

Audit of `cursor/ether-combined` before this branch. Evidence is the code that was already in the repo. The last section is what this branch changes.

## 1. Anyone can post a project idea. Posting notifies the community (in-app plus push). Each user can turn off new-project and new-gig notifications.

**Partial.**

- Posting works. Signed-in users insert into `projects` (`Users can create projects` in the original projects migration). `CreateProjectDialog` and `useProjects.createProject` save the idea as `status: 'open'`.
- In-app and push exist only for people who had opted in. `notify-new-content` selected `notification_preferences.new_projects_enabled = true`, and that column defaulted to `false` (`20260125073712` area in the schema bundle, column add around the notification preferences follow-ups). The settings screen showed the toggle off (`NotificationPreferences.tsx`, `?? false`). A new post did not reach the community.
- Push also required `push_enabled`. That default is already `true`, and the device still has to grant permission. That part matches a normal push setup.
- There was no gig listing and no `new_gigs_enabled` toggle. A search for `gig` in `src` and `supabase` returned nothing.

## 2. The owner adds roles. Each role has pay (amount) and/or XP / bartering credit.

**Partial.**

- Owners add roles on create and in `EditProjectDialog`. `project_roles.payout_amount` is the pay field. Applicants apply to a role id.
- XP / barter was not stored per role. The create dialog has an "LC Credits Reward" slider that never got written on submit. Credits in the ledger are a separate balance system, not role compensation.

## 3. The owner can attach a moodboard (images), videos, YouTube links, and other links/files.

**Works, with one playback gap.**

- `project_attachments` stores image, video, pdf, zip, and link rows. The create dialog accepts files and pasted links, and labels YouTube links as video. `ProjectDetail` embeds a YouTube url and shows images. The owner is the only person the screen lets upload.
- An uploaded video file rendered as a still "Video" label, not a player.

## 4. Users apply to roles. The owner selects applicants, and selected people are added to the project's group chat.

**Works.**

- `useProjectApplications.applyToProject` inserts `project_applications` and calls `notify-new-application`.
- `reviewApplication` sets `accepted` and inserts a `conversation_participants` row with `project_role_name`. `createProject` already opens the group chat and adds the owner. Acceptance falls back to that chat (`conversations.project_id`, type `group`).
- The lookup used `maybeSingle()` on every group chat for the project. That is safe only while a project has one group chat.

## 5. In the group chat everyone is labeled with their role (owner included). Members get push and email for new messages, respecting mute and the email queue. Email is batched or throttled.

**Partial.**

- `conversation_participants.project_role_name` is set to the role, and the owner was labeled "Project Creator". `ChatView` shows that badge on other people's messages in a group, not on your own.
- Mute is stored (`is_muted`) and the chat menu toggles it. `send-dm-notification` did not read it, so a muted chat still emailed and pushed.
- `useMessages` called `send-dm-notification` once per recipient per message. That function sends through Resend immediately. It does not use `enqueue_email` / `process-email-queue`. There was no per-chat throttle.

## 6. Chat supports photos and videos.

**Works.**

- `messages.media_url` / `media_type` allow `image` and `video`. `MessageComposer` picks a photo or video, `useMessages` uploads it to the `media` bucket, and `ChatView` renders `<img>` and `<video>`.

## 7. Subgroups. Any member can open one with a subset of the project. From a subgroup, a member can share selected messages into the main group. The owner can read the main group and every subgroup, even ones they were not added to. Non-members never can. RLS enforces that.

**Missing.**

- Conversations have no parent. There is no share action.
- Read access is "participant or creator" (`Users can view conversations they participate in or created`). The project owner who was not added to a chat cannot read it. A stranger cannot read it either, which is the only part that already held.

## 8. Projects are added to the community calendar automatically. The owner can hide a project from the calendar and can make the project private.

**Partial.**

- `useCalendar` lists projects with a `timeline_start`. `createProject` also inserted a public `events` row when a start date existed, so the same project showed twice. A project with no start date was missing. There is no hide-from-calendar flag.
- `projects.is_private` exists and the browse query filters it in the client. The RLS policy `Anyone can view open projects` does not look at `is_private`, so a private open project was still readable with the API. The extra policy only added a path for the owner and accepted clients. Accepted collaborators were not included. Private projects were also announced, and the extra event was inserted with `is_public: true`.
- `project_attachments` and `project_updates` select policies were `USING (true)` for any signed-in user.

## Other project behavior this spec does not replace

These stay in place. This branch does not remove them.

- Milestones, checklist, call sheets, project updates, progress, cover image.
- Client invites, the token portal (`get_client_project_by_token`), and "include client in production chat".
- Custom role proposals (`accept_custom_role_proposal`).
- AI project matches, energy on create, acceptance and application notifications.
- Project PDF export and the chat command center (expenses and itinerary on a group).
- Public project pages and share links.

Client-token reads use a security definer function, so the tighter project SELECT policy does not lock the portal. Call sheets for a public project stay readable. Call sheets for a private project were already limited.

## What this branch changes

| Spec point | Change |
| --- | --- |
| 1 | `listing_type` is `project` or `gig`. New posts notify in-app and push unless the project is private or the person turned that category off. `new_projects_enabled` defaults to on and existing off rows are turned on, because the old value was the default, not a choice we can tell apart. `new_gigs_enabled` is the gig switch. |
| 2 | `project_roles.credit_amount`. Create and edit show pay and XP on every role. The old slider fills a role's XP when that role's own field is left at 0. |
| 3 | Uploaded videos play in the moodboard. YouTube links still embed. |
| 4 | Acceptance joins the main chat only (`parent_conversation_id` is null and `is_client_chat` is false). A person can apply only when they can already see the project, so a private project does not take applications from strangers. |
| 5 | Owner label is "Owner", including on your own messages. `notify-chat-message` sends push immediately, skips muted chats and people with messages off, and queues at most one email per person per chat per 15 minutes through `enqueue_email`. |
| 6 | Unchanged. Photos and videos already send. |
| 7 | Members create a subgroup from the main chat. `share_messages_to_project_main` copies the selection into the main chat. `can_read_conversation` lets the owner read every project chat. Inserts still require membership. Non-members fail the policies. The one-main-chat index ignores client threads, and an invited client can still be added to that thread. |
| 8 | The calendar reads the project row, including projects with no start date (it uses `created_at`). `hide_from_calendar` and `is_private` keep a project off that calendar. Private projects are not announced. Linked public events for a private project are marked not public. The duplicate event insert on create is gone. |

RLS helpers `can_view_project` and `can_read_conversation` trust a user id only when it is `auth.uid()`, so a direct call cannot ask about someone else.
