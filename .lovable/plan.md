
# Pipeline CRM Enhancements Plan

## Overview
This plan adds task editing, completed task archiving, multi-image gallery uploads, contract/invoice deletion, and a visual task timeline to the Pipeline CRM system.

---

## Feature 1: Editable Tasks

**What it does:** Allows users to edit task titles and due dates after creation to fix typos or update details.

### Implementation

**1.1 Update `useContactTasks.ts` hook**
Add an `updateTask` mutation:
```typescript
const updateTask = useMutation({
  mutationFn: async ({ taskId, title, dueAt }: { 
    taskId: string; 
    title?: string; 
    dueAt?: string | null 
  }) => {
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (dueAt !== undefined) updates.due_at = dueAt;
    
    const { data, error } = await supabase
      .from('contact_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['contact-tasks', pipelineItemId] });
    queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
  },
});
```

**1.2 Update `ContactTasksSection.tsx`**
- Add edit mode state for individual tasks
- Show pencil icon on hover that opens inline edit mode
- Allow editing title and due date
- Save on blur or Enter key press

```text
Task row layout:
[Checkbox] [Title (editable on click)] [Due date] [Edit icon] [Delete icon]
```

---

## Feature 2: Completed Tasks Archive

**What it does:** Provides two options for completed tasks:
1. **Clear All** - Permanently delete completed tasks
2. **Archive** - Move to a "Completed" folder for future reference

### Implementation

**2.1 Database Schema Changes**
Add new columns to `contact_tasks` table:
```sql
ALTER TABLE contact_tasks 
ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN completed_at TIMESTAMPTZ DEFAULT NULL;
```

Update trigger to set `completed_at` when `is_done` changes to true.

**2.2 Update `useContactTasks.ts`**
Add new functions:
- `archiveCompletedTasks()` - Sets `archived_at` on all completed tasks
- `clearCompletedTasks()` - Deletes all completed tasks
- `getArchivedTasks()` - Query for archived tasks

**2.3 Update `ContactTasksSection.tsx`**
Add a section header with action buttons when completed tasks exist:

```text
+------------------------+
| Tasks                  |
+------------------------+
| [Add task input...]    |
|                        |
| ○ Incomplete task 1    |
| ○ Incomplete task 2    |
|                        |
| ▼ Completed (3)        |  [Clear All] [Archive]
| ✓ Done task 1          |
| ✓ Done task 2          |
| ✓ Done task 3          |
+------------------------+
```

**2.4 Create `CompletedTasksArchive.tsx`**
A collapsible section or separate sheet showing archived tasks:
- Grouped by date completed
- Option to restore tasks (un-archive)
- Option to permanently delete individual archived tasks

---

## Feature 3: Task Visualizer / Timeline

**What it does:** Shows a visual timeline/graph of task activity - when tasks were created, completed, and how they connect across contacts.

### Implementation

**3.1 Create `TaskVisualizerSheet.tsx`**
A bottom sheet or dialog with:
- **Timeline view**: Vertical timeline showing task events (created, completed, deleted)
- **Stats summary**: Total tasks completed this week/month
- **Contact breakdown**: Which contacts had the most tasks

```text
+----------------------------------+
|  Task Activity Timeline          |
+----------------------------------+
|                                  |
|  Today                           |
|  ├─ ✓ "Send proposal" completed  |
|  │    → cadre wallace            |
|  │                               |
|  ├─ + "Follow up call" created   |
|  │    → john doe                 |
|  │                               |
|  Yesterday                       |
|  ├─ ✓ "DO REHEARSALS" completed  |
|  │    → cadre wallace            |
|  │                               |
|  This Week                       |
|  ├─ 8 tasks completed            |
|  ├─ 3 tasks created              |
|  └─ Most active: cadre wallace   |
|                                  |
+----------------------------------+
```

**3.2 Database: Add task_events table**
```sql
CREATE TABLE public.task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  task_id UUID REFERENCES contact_tasks(id) ON DELETE SET NULL,
  pipeline_item_id UUID REFERENCES pipeline_items(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'completed', 'archived', 'deleted', 'updated'
  task_title TEXT NOT NULL, -- Snapshot of title at event time
  contact_name TEXT, -- Snapshot of contact name
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**3.3 Trigger to log task events**
Create triggers on `contact_tasks` to automatically log:
- INSERT → log 'created' event
- UPDATE (is_done: false → true) → log 'completed' event
- DELETE → log 'deleted' event

**3.4 UI Integration**
Add a "View Activity" button to the Tasks section header that opens the visualizer sheet.

---

## Feature 4: Multi-Image Gallery Upload

**What it does:** Gallery section already supports multiple uploads (see line 99 in `ContactGallerySection.tsx`), but we should enhance the UX.

### Current State
The gallery already accepts `multiple` files:
```typescript
<input ref={fileInputRef} type="file" accept="image/*,video/*" multiple />
```

### Enhancements

**4.1 Improve upload feedback**
- Show upload progress for multiple files
- Display count of files being uploaded
- Allow canceling individual uploads

**4.2 Update `ContactGallerySection.tsx`**
```text
Gallery (5)                               [Upload]
+--------+  +--------+  +--------+
| img 1  |  | img 2  |  | img 3  |
+--------+  +--------+  +--------+
+--------+  +--------+
| img 4  |  | + Add  |  ← Empty slot to add more
+--------+  +--------+
```

---

## Feature 5: Delete Contracts & Invoices (Even After Sent)

**What it does:** Allows deleting contracts and invoices regardless of status to reduce clutter.

### Current State
The delete functionality exists but may only show for draft status.

### Implementation

**5.1 Update `ContactContractsSection.tsx`**
- Show delete button for ALL statuses (draft, sent, signed, completed)
- Add confirmation dialog warning that sent/signed contracts will be deleted
- Include the contract number in the confirmation for safety

**5.2 Update `ContactInvoicesSection.tsx`**
- Show delete button for ALL statuses (draft, sent, paid, overdue)
- Add confirmation dialog for non-draft invoices
- Include invoice number in confirmation

**5.3 UI Changes**
Add delete icon to each contract/invoice card:
```text
+----------------------------------+
| CTR-202601-1234          [draft] |
| Photography Agreement            |
| $500                             |
|                                  |
|    [Send]  [Sign]  [🗑 Delete]   |
+----------------------------------+
```

For sent/signed items, show confirmation:
```text
"Delete CTR-202601-1234?"
This contract has been sent to the client. 
Deleting it will remove it permanently.
[Cancel] [Delete]
```

---

## Technical Summary

### Database Changes Required
```sql
-- 1. Add archive/completion tracking to tasks
ALTER TABLE contact_tasks 
ADD COLUMN archived_at TIMESTAMPTZ,
ADD COLUMN completed_at TIMESTAMPTZ;

-- 2. Create task events log for visualizer
CREATE TABLE task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  task_id UUID,
  pipeline_item_id UUID,
  event_type TEXT NOT NULL,
  task_title TEXT NOT NULL,
  contact_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS policies for task_events
CREATE POLICY "Users can view own events" ON task_events 
  FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can create own events" ON task_events 
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

-- 4. Triggers for automatic event logging
CREATE FUNCTION log_task_event() RETURNS TRIGGER...
```

### Files to Create
- `src/components/pipeline/TaskVisualizerSheet.tsx`
- `src/components/pipeline/CompletedTasksArchive.tsx`
- `src/hooks/useTaskEvents.ts`

### Files to Modify
- `src/hooks/useContactTasks.ts` - Add updateTask, archiveTask, getArchivedTasks
- `src/components/pipeline/ContactTasksSection.tsx` - Add edit mode, archive UI, visualizer button
- `src/components/pipeline/ContactContractsSection.tsx` - Show delete for all statuses
- `src/components/pipeline/ContactInvoicesSection.tsx` - Show delete for all statuses
- `src/components/pipeline/ContactGallerySection.tsx` - Enhanced multi-upload feedback

---

## User Experience Flow

1. **Editing a task**: Click task title → inline edit mode → type correction → press Enter or click away
2. **Archiving completed tasks**: Complete tasks → click "Archive" → tasks move to archive folder
3. **Viewing task history**: Click "Activity" button → see timeline of all task events
4. **Uploading multiple images**: Click upload → select multiple files → see progress → all appear in gallery
5. **Deleting sent contracts**: Click delete on contract → confirm deletion → contract removed

