

# Fix Moodboard Upload + Add Direct Recipient Targeting

Three issues to fix in the Invite Audience flow:

## 1. Moodboard upload broken

The file input likely fails because `event-moodboard` storage path or RLS isn't set up, or the input only accepts images. Fix:
- Verify `media` bucket policy allows `${auth.uid()}/event-moodboard/...` writes (add policy if missing).
- Expand `<input accept="...">` to include all supported MIME types (`image/*,application/pdf,video/*,.doc,.docx,.ppt,.pptx,.txt,.zip`).
- Surface upload errors via toast so failures aren't silent.
- Confirm `useEventMoodboard.uploadMoodboardFile` writes `file_type/file_name/file_size/mime_type` and inserts the row.

## 2. Send to specific users by name

Add a **"Specific People"** audience mode alongside the filter-based modes:
- Type-ahead user search (reuses `useUserSearch` against `profiles_public`).
- Selected users render as removable chips.
- Reach count = number of chips selected.
- Send path: pass `userIds: string[]` to `send-audience-invite` edge function; function branches — if `userIds` present, skip `get_audience_preview` and target those users directly.

## 3. Send to outside (off-platform) people

Add a **"External Guests"** mode (or section) reusing the existing `send-event-invite` edge function which already handles email/SMS to non-members:
- Rows of `{ name, email, phone }` inputs (same UX as existing `InviteGuestsDialog`).
- On send, route to `send-event-invite` instead of `send-audience-invite`.
- Allow mixing: if both platform users and external guests are added, fire both functions in parallel.

## UI structure

Top of dialog gets a 3-tab segmented control:

```text
[ Audience Filter ] [ Specific People ] [ External Guests ]
```

- **Audience Filter** — existing location/age/smart-match flow (unchanged).
- **Specific People** — search box + selected chips + message composer.
- **External Guests** — name/email/phone rows + message composer.

Moodboard section stays below the tabs (shared across all modes).

## Files to change

- `src/components/events/InviteAudienceDialog.tsx` — add tabs, user search picker, external guest rows, fix file input `accept`, wire send routing.
- `src/hooks/useEventMoodboard.ts` — better error surfacing on upload failure.
- `supabase/functions/send-audience-invite/index.ts` — accept optional `userIds: string[]` and skip filter query when present.
- New migration only if `media` bucket lacks the `event-moodboard` path policy (will check first).

## QA

- Upload a PDF and a PNG to moodboard → both appear, PDF shows file card, PNG shows thumbnail.
- Search "char" in Specific People → real profiles appear, select 2 → reach shows 2 → send delivers to those 2.
- Add 1 external email + 1 external phone → both receive invite via existing guest invite flow.
- Mix: 2 platform users + 1 external email → both edge functions fire, both succeed.

