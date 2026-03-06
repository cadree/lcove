

## Public Client Portal with Sharing, Calendar, and PDF Export

### What We're Building

Transform the client invite flow from an in-app-only experience to a **public-facing client portal** accessible via a unique link (no sign-in required). The owner can share this link via SMS, email, etc. The client portal shows the simplified project dashboard with options to add to calendar and download a PDF breakdown.

### Architecture

```text
Owner clicks "Invite Client"
  ├── Search & invite existing users (existing flow - keep)
  └── NEW: "Share Client Link" tab
        ├── Generates a unique token → stored in project_clients
        ├── Multi-channel share (SMS, Email, Copy Link, System Share)
        └── Link goes to /client/:token (public route, no auth)

/client/:token (PublicClientPortal page)
  ├── Validates token via security definer function
  ├── Renders ClientDashboardView (read-only)
  ├── "Add to Calendar" button (reuse AddToCalendarButtons)
  └── "Download PDF" button (client-side jsPDF generation)
```

### Database Changes

1. **Add `client_token` column to `project_clients`** — a unique text token for link-based access. Nullable (existing in-app invites don't need it).
2. **Add `client_name` and `client_email` columns** — for external clients who aren't platform users (`client_user_id` becomes nullable).
3. **Create a `get_client_project_by_token` security definer function** — returns project data for a valid token without requiring auth. Similar pattern to `get_public_creator_profile`.
4. **RLS**: The function bypasses RLS (security definer), so no policy changes needed for public access.

### Frontend Changes

**1. New page: `src/pages/PublicClientPortal.tsx`**
- Route: `/client/:token`
- Calls `get_client_project_by_token` RPC to fetch project + roles + attachments + call sheets
- Renders a public version of `ClientDashboardView` with:
  - "Add to Calendar" dropdown (reuse `AddToCalendarButtons` component)
  - "Download PDF" button using jsPDF (already installed)
- No auth required

**2. Update `ClientInviteDialog.tsx`**
- Add a "Share Link" tab alongside the existing user search
- Owner enters client name + email/phone (optional)
- Generates a token, inserts into `project_clients` with `client_token`
- Shows multi-channel share options: Copy Link, SMS (`sms:` URI), Email (`mailto:` URI), System Share (`navigator.share`)

**3. New utility: PDF generation function**
- Uses jsPDF (already installed) to generate a project breakdown PDF
- Includes: title, description, progress, timeline, confirmed roles, supplies, props, deliverables, call sheets, milestones

**4. Update `App.tsx`**
- Add route: `<Route path="/client/:token" element={<PublicClientPortal />} />`

### Files to Create/Modify

| Action | File |
|--------|------|
| Migration | Add `client_token`, `client_name`, `client_email` to `project_clients`; make `client_user_id` nullable; create `get_client_project_by_token` function |
| Create | `src/pages/PublicClientPortal.tsx` |
| Create | `src/lib/generateProjectPdf.ts` |
| Modify | `src/components/projects/ClientInviteDialog.tsx` (add Share Link tab) |
| Modify | `src/components/projects/ClientDashboardView.tsx` (add calendar + PDF buttons) |
| Modify | `src/App.tsx` (add route) |
| Modify | `supabase/functions/share-page/index.ts` (add `c` type for client portal OG tags) |

### Security Notes
- Token is a random UUID — unguessable
- Security definer function only returns project data, never internal/sensitive info
- External clients cannot edit anything — purely read-only
- Token can be revoked by removing the `project_clients` row

