

# Projects Section Audit & Fix Plan

## Issues Identified

1. **No file preview for non-image files** -- PDFs, docs, ZIPs only show a generic icon with no meaningful preview
2. **Download button opens in new tab instead of downloading** -- The current `<a href target="_blank">` just navigates; it doesn't trigger a file download
3. **YouTube links not playable** -- Video links are displayed as static icons instead of embedded players
4. **No image lightbox/fullscreen view** -- Clicking an image does nothing; users can't zoom in
5. **Project Card missing cover image preview** -- Cards don't show uploaded images as a visual banner

---

## Fix 1: File Preview Thumbnails

Enhance the Mood Board tab in `ProjectDetail.tsx`:
- **Images**: Show full preview thumbnails (already works, keep as-is)
- **PDFs**: Show a PDF icon with the filename clearly visible and a "Preview" badge
- **Videos (uploaded)**: Show a play icon overlay on a muted-foreground background
- **YouTube/video links**: Embed a YouTube iframe player or show a clickable thumbnail that opens the video
- **Links (Figma, Drive)**: Show a recognizable icon (Figma logo placeholder, Drive icon) with the URL domain

---

## Fix 2: Working Download Button

Replace the current `<a href target="_blank">` with a proper download mechanism:
- For storage files: Use `download` attribute on the anchor tag plus set the filename
- For external links: Open in new tab (can't force download on external URLs)
- Add a visible "Download" label next to the icon for clarity

---

## Fix 3: Embedded YouTube Player

When an attachment has `file_type === 'video'` and the `file_url` contains `youtube.com` or `youtu.be`:
- Extract the YouTube video ID from the URL
- Render an embedded `<iframe>` player with the YouTube embed URL
- For non-YouTube video links, show a clickable link that opens in a new tab

---

## Fix 4: Image Preview on Project Cards

Update `ProjectCard.tsx`:
- If `cover_image_url` exists, show it as a banner image at the top of the card
- Use `object-cover` with a fixed aspect ratio for consistency

---

## Fix 5: Full Audit Fixes

- **Custom role proposal** -- The "Propose Your Own Role" section collects input but never submits it (no submit button or mutation). Add a submit handler.
- **Attachment upload by collaborators** -- Currently only the creator uploads during creation. Add an upload button in the Mood Board tab for the creator to add more files after creation.
- **Progress slider debounce** -- The progress slider fires on every change. Add a debounced save to avoid excessive API calls.

---

## Technical Details

### Files to modify:
- `src/components/projects/ProjectDetail.tsx` -- Major: fix download, add YouTube embed, improve file previews, add post-creation upload, fix custom role submit
- `src/components/projects/ProjectCard.tsx` -- Minor: add cover image banner
- `src/hooks/useProjectAttachments.ts` -- Already has upload/delete mutations (no changes needed)

### YouTube embed helper:
```text
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
```

### Download approach:
```text
For storage files: <a href={url} download={filename}>
For external links: <a href={url} target="_blank" rel="noopener">
```

### No database changes required -- all fixes are frontend-only.

