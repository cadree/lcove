
# Plan: Make Partner Application Form Visible on the Brand Partners Page

## Understanding the Issue
You're on the `/brand-partners` page and expected to see the partner submission form directly, but currently the form is hidden behind a "Become a Partner" button that opens a dialog/modal when clicked.

## Proposed Solution
I'll restructure the Brand Partners page to show the application form prominently and directly on the page, making it immediately visible without needing to click a button.

## Technical Implementation

### 1. Restructure the Brand Partners Page Layout
**File: `src/pages/BrandPartners.tsx`**
- Replace the current hero card with a two-column layout (on larger screens)
- Left side: Application form (always visible)
- Right side: List of existing partners
- On mobile: Stack the form above the partners list

### 2. Inline the Application Form
- Move the form content from `BrandApplicationDialog` directly into the page
- Keep the dialog component for potential reuse elsewhere, but embed form in page
- Add clear section headers: "Apply to Partner" and "Our Partners"

### 3. Visual Hierarchy
- Add a prominent "Apply to Partner" section with the full form visible
- Include all fields: Business name, category, contact details, description, what they bring to the table, member benefits
- Show existing partners below or beside the form

## Page Structure After Changes
```text
+------------------------------------------+
|  Brand Partners                           |
+------------------------------------------+
|  APPLY TO PARTNER                         |
|  +------------------------------------+   |
|  | Business Name: [____________]      |   |
|  | Category: [Dropdown_______]        |   |
|  | Contact Email: [____________]      |   |
|  | Description: [Textarea______]      |   |
|  | What You Bring: [Textarea___]      |   |
|  | Member Benefits: [__________]      |   |
|  | [Submit Application Button]        |   |
|  +------------------------------------+   |
+------------------------------------------+
|  CURRENT PARTNERS                         |
|  [Partner Card 1] [Partner Card 2] ...   |
+------------------------------------------+
```

## Files to Modify
1. **`src/pages/BrandPartners.tsx`** - Add inline application form section
2. Keep `src/components/brandpartners/BrandApplicationDialog.tsx` intact for potential modal use

This will make the application form immediately visible when you visit the page, no button click required.
