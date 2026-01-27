

# Plan: Fix Gallery Unlimited Uploads + Enhanced Content Management

## Problem Summary

1. **Gallery is limited to 2 pictures**: The upload process may be failing silently after 2 uploads due to how the upload queue and `isUploading` state are managed
2. **User wants to edit/remove invoices, contracts, and tasks**: These capabilities exist but may not be obvious to users

---

## Technical Investigation

After reviewing the code, I identified these issues:

### Gallery Upload Issue
The `ContactGallerySection.tsx` uses a sequential upload loop that should handle unlimited files. However, there could be issues with:
- The `isUploading` flag from `useContactMedia` hook blocking additional uploads
- The upload queue not resetting properly between batches
- Possible race conditions in state updates

### Content Management
Looking at the current implementation:
- **Tasks**: Already have edit (pencil) and delete (trash) buttons visible on mobile
- **Invoices**: Delete button exists but only visible for all statuses
- **Contracts**: Delete button exists for all statuses  
- **Quotes**: Delete button exists next to the status dropdown

The "Edit" button at the bottom of the drawer only modifies contact details, not section items.

---

## Implementation Plan

### 1. Fix Gallery Multi-Upload (Priority Fix)

**File: `src/hooks/useContactMedia.ts`**
- Remove `isUploading` dependency that may block concurrent uploads
- Ensure the mutation can handle multiple parallel uploads

**File: `src/components/pipeline/ContactGallerySection.tsx`**
- Change from sequential upload loop to parallel Promise.all approach
- Fix the upload button from being disabled during batch uploads
- Add better error recovery so one failed upload doesn't stop others

### 2. Enhance Invoice Management

**File: `src/components/pipeline/ContactInvoicesSection.tsx`**
- Add an "Edit" mode for invoices (currently you can only create, send, or delete)
- Make delete button always visible and more prominent

### 3. Enhance Contract Management

**File: `src/components/pipeline/ContactContractsSection.tsx`**
- Add a visible delete button in the contract list (currently it exists but may be hard to find)
- Ensure delete works for all contract statuses

### 4. Improve Task Visibility

**File: `src/components/pipeline/ContactTasksSection.tsx`**
- Already has edit and delete visible on mobile - verify this is working
- Ensure Archive and Clear buttons are easy to access

### 5. Add Quick Actions Toolbar (UX Enhancement)

**File: `src/components/pipeline/PipelineItemDrawer.tsx`**
- Add a "Manage Content" section or make it clearer that users can interact with individual items

---

## Code Changes Detail

### Gallery Upload Fix (Critical)

```typescript
// Change the upload approach to use Promise.all for parallel uploads
// and ensure the upload button isn't blocked mid-batch

const handleFileSelect = async (files: FileList) => {
  const fileArray = Array.from(files);
  
  // Upload all files in parallel instead of sequentially
  const uploadPromises = fileArray.map(async (file, index) => {
    try {
      await uploadMedia({ file, mediaType: getMediaType(file) });
      return { success: true, index };
    } catch (error) {
      return { success: false, index, error };
    }
  });
  
  const results = await Promise.all(uploadPromises);
  // Show summary of successes/failures
};
```

### Delete Button Visibility

For invoices and contracts, ensure the delete button is:
- Always visible (not hidden behind opacity states)
- Available for ALL statuses (draft, sent, paid, etc.)
- Has a confirmation dialog for non-draft items

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/pipeline/ContactGallerySection.tsx` | Fix multi-upload to allow unlimited pictures |
| `src/hooks/useContactMedia.ts` | Optimize for parallel uploads |
| `src/components/pipeline/ContactInvoicesSection.tsx` | Make delete more visible, add edit capability |
| `src/components/pipeline/ContactContractsSection.tsx` | Ensure delete is visible for all statuses |
| `src/components/pipeline/ContactQuotesSection.tsx` | Ensure delete and edit are easily accessible |

---

## Expected Outcome

After these changes:
- Users can add unlimited photos/videos to the gallery
- All items (invoices, contracts, quotes, tasks) can be easily edited or deleted
- Delete buttons are always visible, not hidden behind hover states on mobile
- Better visual feedback during uploads

