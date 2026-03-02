
# Projects Feature Upgrade Plan

This is a major expansion of the Projects system across database, creation flow, detail view, and public visibility. Due to the scope, this will be broken into phases.

---

## Phase 1: Database Schema Additions

New tables and columns needed via migration:

### `projects` table -- new columns:
- `expected_outcome` (text) -- Portfolio piece, Paid production, Experimental, Community collab
- `budget_range` (text) -- e.g. "$0-500", "$500-2000", etc.
- `equipment_needed` (text)
- `location_secured` (boolean, default false)
- `venue` (text)
- `props_needed` (text)
- `sponsorship_needed` (boolean, default false)
- `vendors_needed` (boolean, default false)
- `progress_percent` (integer, default 0)
- `is_moodboard_public` (boolean, default false)
- `deliverables` (jsonb) -- array of deliverable objects (type, publish_date, publish_location)
- `allow_custom_roles` (boolean, default false)

### New table: `project_attachments`
- `id` (uuid, PK)
- `project_id` (uuid, FK to projects)
- `uploaded_by` (uuid, FK reference)
- `file_url` (text)
- `file_name` (text)
- `file_type` (text) -- image, pdf, video, doc, link, zip
- `file_size` (bigint, nullable)
- `created_at` (timestamptz)

RLS: Creator can insert/delete own attachments. Authenticated users can select attachments for any project.

### New table: `project_updates`
- `id` (uuid, PK)
- `project_id` (uuid, FK)
- `author_id` (uuid)
- `content` (text)
- `created_at` (timestamptz)

RLS: Creator can insert. Authenticated users can select.

### Modify `project_milestones` -- add a `phase` column:
- `phase` (text, nullable) -- pre_production, production, post_production, final_delivery, custom

### Add calendar event on project creation
- Insert a public event into the `events` table when a project is created (using the project's timeline).

---

## Phase 2: Enhanced Create Project Dialog

Update `CreateProjectDialog.tsx` to add the following sections in order:

1. **Expected Outcome** -- multi-select chips: Portfolio piece, Paid production, Experimental, Community collab
2. **Visual References / Mood Board** (upgrade existing):
   - Support multiple file uploads (images, PDFs, videos, docs, ZIPs)
   - Support pasting external links (Google Drive, Figma, YouTube)
   - Show preview thumbnails with file type badges
   - Drag-and-drop area
   - "Make Mood Board Public" toggle
3. **Budget & Resources** section:
   - Budget Range dropdown
   - Equipment Needed (text)
   - Location Secured toggle + Venue text input
   - Props Needed (text)
   - Sponsorship Needed toggle
   - Vendors Needed toggle
4. **Roles** -- add "Allow applicants to define their own role" toggle
5. **Timeline with Milestones**:
   - Keep start/end dates
   - Add milestone entries: Pre-production, Production, Post-production, Final Delivery
   - Allow adding custom milestones with title + due date
6. **Deliverables** section:
   - What will be delivered (multi-select): Photos, Film, Edited reels, Final garment, Event
   - Expected publish date
   - Where it will be published (text)

---

## Phase 3: Enhanced Project Detail View

Update `ProjectDetail.tsx` to show all new data:

1. **Mood Board / Attachments tab** -- grid of uploaded files with:
   - Preview thumbnails (images inline, icons for docs/PDFs)
   - File type badges
   - Download button for collaborators
2. **Budget & Resources section** -- display equipment, venue, sponsorship needs
3. **Expected Outcome badges**
4. **Timeline with Milestones visual** -- vertical timeline showing phases with status indicators
5. **Deliverables section** -- list of expected outputs
6. **Progress Tracking**:
   - Status badge (already exists)
   - Progress slider (owner only can edit)
   - Update log tab -- chronological list of project updates
7. **Custom role application** -- if `allow_custom_roles` is true, show a text input where applicants can propose their own role name

---

## Phase 4: Calendar Integration

When a project is created with a `timeline_start`:
- Automatically insert a public event into the `events` table
- Title: project title
- Date: timeline_start
- Description: project description
- Link back to the project

---

## Phase 5: Project Card Updates

Update `ProjectCard.tsx` to show:
- Progress bar (using `progress_percent`)
- Expected outcome badge
- Attachment count indicator

---

## Technical Details

### Files to create:
- `src/hooks/useProjectAttachments.ts` -- CRUD for attachments
- `src/hooks/useProjectUpdates.ts` -- CRUD for update log

### Files to modify:
- `src/integrations/supabase/types.ts` -- auto-updated after migration
- `src/components/projects/CreateProjectDialog.tsx` -- major expansion
- `src/components/projects/ProjectDetail.tsx` -- major expansion
- `src/components/projects/ProjectCard.tsx` -- minor updates
- `src/hooks/useProjects.ts` -- add new fields to create/query
- `src/hooks/useProjectMilestones.ts` -- add phase field

### Database migration:
- One migration adding all new columns, tables, and RLS policies
- Storage: use existing `media` bucket with path `project-attachments/{user_id}/...`

### Considerations:
- File uploads use the existing `media` storage bucket with user-id-prefixed paths for RLS compliance
- Deliverables stored as JSONB to keep schema flexible
- Progress percent is manually set by project owner via a slider
- Calendar event creation happens in the `createProject` mutation after project insert
