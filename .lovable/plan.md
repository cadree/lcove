
# Add Dedicated Privacy Access on Home Page

## Overview

Adding a visible, dedicated "Legal" section to the Home page so users can easily navigate to the Privacy Policy and Terms of Service pages directly from `/home`. This ensures compliance visibility for iOS App Store and Google Play Store requirements.

---

## Current Structure

The Home page (`src/pages/Index.tsx`) displays:
- Header with avatar, logo, energy, notifications
- Search bar
- Pinned, Recent, Most Used sections
- Explore section with categorized navigation items

The navigation items are defined in `src/config/homeItems.ts` and grouped by categories: `core`, `discover`, `create`, `business`, `profile`.

---

## Implementation Plan

### Option A: Add Legal Section to Home Page (Recommended)

Add a new "Legal & Support" section at the bottom of the Home page, before the BottomNav, containing links to Privacy Policy and Terms of Service.

**Files to Modify:**

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add a new Legal section component before `<BottomNav />` |

**Implementation Details:**

```text
┌─────────────────────────────────────┐
│           Home Page                 │
├─────────────────────────────────────┤
│  [Header: Avatar, Logo, Bells]      │
│  [Search Bar]                       │
│  [Pinned Section]                   │
│  [Recent Section]                   │
│  [Most Used Section]                │
│  [Explore Section]                  │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  📋 Legal & Support             ││
│  │  ├── 📄 Privacy Policy          ││
│  │  └── ⚖️ Terms of Service        ││
│  └─────────────────────────────────┘│
│                                     │
│  [Bottom Navigation]                │
└─────────────────────────────────────┘
```

**Code to Add in `src/pages/Index.tsx`:**

A new section with two Link components:
- Privacy Policy link → `/privacy`
- Terms of Service link → `/terms`

Styled consistently with the existing glass card design used throughout the app.

---

## Visual Design

The Legal section will:
- Use the same `rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm` styling as other sections
- Include a small header "Legal & Support"
- Display two tappable rows with icons:
  - `FileText` icon for Privacy Policy
  - `Scale` icon for Terms of Service
- Show chevron arrows indicating navigation

---

## Summary of Changes

| File | Lines Changed |
|------|--------------|
| `src/pages/Index.tsx` | ~35 new lines |

This approach:
- Makes legal pages visible directly from `/home`
- Follows existing UI patterns for consistency
- Meets App Store requirements for accessible legal documentation
- Does not require changes to the navigation config since these are static legal pages, not feature destinations
