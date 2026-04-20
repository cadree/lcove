
Fix the external guest invitation email path so it uses the app’s managed email system instead of the current direct-send approach, then back-test the full flow.

1. Enable a proper sender domain for the project
- The project currently has no configured sender domain, so reliable branded email delivery is not fully set up.
- First step will be to connect a sender domain in the app’s email settings so outbound invitation emails can be tracked and delivered through the built-in email infrastructure.

2. Move external guest emails onto the managed email pipeline
- Refactor `send-event-invite` so email invitations no longer depend on the current raw API call.
- Keep SMS support as-is, but route email sends through the project’s managed email flow for better deliverability and logging.
- Use the event’s public URL in the invitation instead of the internal function URL.

3. Harden the invite function response
- Return per-recipient results with separate statuses for email and SMS.
- Distinguish clearly between:
  - sent
  - queued
  - skipped (missing email / missing phone / email disabled)
  - failed
- Include readable failure messages so the UI can surface the real reason when an invite does not go out.

4. Update the external guest UI feedback
- In `src/components/events/InviteAudienceDialog.tsx`, show a clearer success/error summary after send.
- If some guests succeed and others fail, report a partial-success message instead of a generic “sent” toast.
- Keep the existing external guest entry UX, but improve visibility into what happened.

5. Add delivery observability
- Make sure external guest email sends can be verified in the project’s email logs rather than only relying on function console logs.
- This will make future debugging much easier and prevent “it says sent but never arrived” situations.

6. Back-test the full flow
- Test 1: external guest with email only
  - confirm the function returns success
  - confirm the email appears in delivery logs
  - confirm the invitation arrives in the inbox
- Test 2: external guest with phone only
  - confirm SMS still works after the email refactor
- Test 3: external guest with both email and phone
  - confirm both channels are processed correctly
- Test 4: invalid or missing contact data
  - confirm the UI shows a clear error instead of silent failure

Files to update
- `supabase/functions/send-event-invite/index.ts`
- `src/components/events/InviteAudienceDialog.tsx`
- Possibly email infrastructure files if the managed email flow needs to be scaffolded for this project

Expected outcome
- External guest invitations will send through the project’s proper email system
- Delivery will be trackable
- Failures will be visible in the UI
- The flow will be verified end-to-end after implementation
