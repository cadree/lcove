

## Issues Identified

There are **two distinct problems** visible in the screenshots:

### Problem 1: "View Full Project" button doesn't auto-open the project
The `PublicProjectPage` navigates to `/projects?open=${projectId}`, but `Projects.tsx` **never reads the `open` query parameter**. It only handles `action=create`. So users land on the generic projects list and have to manually find and click the project.

### Problem 2: Non-authenticated users can't apply from the public page
The "Sign In to Apply" button redirects to `/auth?redirect=/projects?open=${projectId}`, but the `?open=` param is part of the redirect URL's query string and likely gets mangled. After auth, the user still lands on the projects list with no project opened.

---

## Fix Plan

### 1. Add `open` query param handling in `Projects.tsx`
Add a `useEffect` that reads `searchParams.get('open')`, finds the matching project in the loaded list, and auto-opens the `ProjectDetail` sheet.

```
useEffect → read "open" param → find project by ID → setSelectedProject + setDetailOpen(true) → clear param
```

This mirrors the existing pattern used in `Pipeline.tsx` for `openContact`.

### 2. Fix the auth redirect URL encoding in `PublicProjectPage.tsx`
The redirect URL `/projects?open=${projectId}` contains a `?` which breaks when used as a query param value. Encode it properly with `encodeURIComponent`.

Change:
```
/auth?redirect=/projects?open=${projectId}
```
To:
```
/auth?redirect=${encodeURIComponent(`/projects?open=${projectId}`)}
```

### Files to modify:
- `src/pages/Projects.tsx` — Add `open` param handling useEffect
- `src/pages/PublicProjectPage.tsx` — Fix redirect URL encoding

