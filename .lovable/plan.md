

## Event Detail Page Audit

After reviewing the full `EventDetail.tsx` (913 lines), here are the issues found:

### Bugs to Fix

1. **Dual Tabs instances causing ref warnings**
   - The `<Tabs>` component is rendered twice: once in the header (lines 295-318) for the `TabsList`, and again in `<main>` (lines 329-373) for the `TabsContent`. These are two separate unconnected `<Tabs>` components sharing the same `activeTab` state. This works functionally but causes the console warnings about refs on `FinanceTab` and `TeamTab` because Radix expects `TabsContent` to be a direct child of the same `Tabs` provider as the `TabsList`.
   - **Fix**: Wrap the entire header + main in a single `<Tabs>` component instead of two separate ones.

2. **Edit Event menu item does nothing**
   - Line 240-243: "Edit Event" dropdown item has no `onClick` handler.
   - **Fix**: Wire it to open an edit dialog or navigate to an edit page.

3. **Delete Event menu item does nothing**
   - Line 244-247: "Delete Event" dropdown item has no `onClick` handler.
   - **Fix**: Add a confirmation dialog and delete logic (same pattern as ProfileEventsDashboard).

4. **Orders tab doesn't show guest orders**
   - Line 400-403: Orders search filters by `attendeeProfiles[order.user_id]` but guest RSVPs have `user_id: null`. Guest ticket purchases won't show profile names and search won't match them.
   - **Fix**: Check for `guest_name`/`guest_email` in the orders filter and display.

5. **Download button on Attendees tab does nothing**
   - Line 626-628: The download button has no `onClick` handler.
   - **Fix**: Add CSV export functionality for the attendee list.

6. **Mail button on each attendee does nothing**
   - Line 679-681: No `onClick` handler.
   - **Fix**: Wire to open a compose dialog or email link.

7. **Marketing tab cards are not interactive**
   - "Email Blast" and "Push Notification" cards (lines 700-713) have `cursor-pointer` but no `onClick`.
   - **Fix**: Wire to the existing `send-mass-notification` / `send-event-reminder` edge functions.

8. **"View Public Page" menu item navigates incorrectly**
   - Line 236: Navigates to `/calendar?event=${eventId}` instead of the public page at `/event/${eventId}`.
   - **Fix**: Change to `navigate(\`/event/${eventId}\`)`.

### Implementation Plan

**File**: `src/pages/EventDetail.tsx`

**Step 1** - Merge dual `<Tabs>` into a single wrapper around header + main to fix the ref warnings.

**Step 2** - Fix "View Public Page" URL to `/event/${eventId}`.

**Step 3** - Add delete handler with confirmation dialog to the "Delete Event" menu item (reuse the pattern from ProfileEventsDashboard: `supabase.from('events').delete()` + invalidate queries + navigate back).

**Step 4** - Add edit handler to navigate to calendar with edit mode or open an inline edit form.

**Step 5** - Fix Orders tab to handle guest orders (show `guest_name`/`guest_email` when `user_id` is null).

**Step 6** - Add CSV export for the attendee download button.

**Step 7** - Wire Mail buttons to `mailto:` links for guests with emails, or open a compose flow.

**Step 8** - Wire Marketing tab cards to trigger the existing edge functions (`send-event-reminder`, `send-mass-notification`).

### Technical Details

- The dual-Tabs fix restructures the JSX so `<Tabs value={activeTab}>` wraps both the sticky header (containing `TabsList`) and the `<main>` (containing `TabsContent`). This eliminates the Radix ref warnings.
- Delete uses `useQueryClient` to invalidate `dashboard-events` and `event-detail` queries, then navigates to `/dashboard/events`.
- CSV export builds a blob from attendee data (name, email, phone, status, date) and triggers a download.
- Guest order display falls back to `guest_name` / `guest_email` when `user_id` is null.

