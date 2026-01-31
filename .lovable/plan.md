
# Brand Partners Page & Collectives Builder

## Overview

This plan implements two key features from the landing page PersonaCards:

1. **Brand Partners Page** - A dedicated page showcasing all brand partners with their exclusive community offerings and business information
2. **Collectives Builder** - A guided onboarding flow for creators to build their own sub-communities within the app

---

## Feature 1: Brand Partners Page

### Current State
- The "Partner with Us" button on PersonaCards navigates to `/partners`
- The `/partners` page exists but is for **local partners** (studios, venues, cafes) - not brand partners
- `brand_partnerships` table exists with sponsor/collaborator/supporter types
- `BrandPartners` component displays brand partners in the discovery section

### Implementation

**New Page: `/brand-partners`**

Create a dedicated page that showcases brands offering exclusive benefits to the community.

| File | Action |
|------|--------|
| `src/pages/BrandPartners.tsx` | New - Main brand partners page |
| `src/hooks/useBrandPartnerships.ts` | Update - Add expanded queries for partner profiles |
| `src/components/landing/PersonaCards.tsx` | Update - Change Brands ctaAction to `/brand-partners` |
| `src/App.tsx` | Update - Add route |

**Page Structure:**

```text
┌────────────────────────────────────────┐
│  Header: "Brand Partners"              │
│  Subtitle: Exclusive community offers  │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │  Become a Brand Partner CTA      │  │
│  │  [Apply to Partner]              │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  Filter: [All] [Sponsors] [Collab]     │
├────────────────────────────────────────┤
│  Brand Card Grid:                      │
│  ┌─────────────┐ ┌─────────────┐      │
│  │ Brand Logo  │ │ Brand Logo  │      │
│  │ Name        │ │ Name        │      │
│  │ Type badge  │ │ Type badge  │      │
│  │ Exclusive   │ │ Exclusive   │      │
│  │ Offer       │ │ Offer       │      │
│  └─────────────┘ └─────────────┘      │
└────────────────────────────────────────┘
```

**Brand Detail Sheet:**
- Brand logo and cover image
- Partnership type badge (Sponsor/Collaborator/Supporter)
- Exclusive community offerings section
- About the business section
- Website and social links
- "Claim Offer" or "Learn More" CTA

**Database Changes:**

Extend `brand_partnerships` table with additional columns for business info:

```sql
ALTER TABLE brand_partnerships ADD COLUMN IF NOT EXISTS 
  about_business TEXT,
  exclusive_offer TEXT,
  offer_code TEXT,
  offer_terms TEXT,
  social_links JSONB DEFAULT '{}',
  contact_email TEXT,
  featured BOOLEAN DEFAULT false;
```

---

## Feature 2: Collectives Builder

### Current State
- "Start a Collective" button goes to `/auth`
- Group chats exist with `is_community_hub`, `visibility`, `topic`, `description` fields
- `conversation_participants` has `role` (owner/moderator/member)
- `useCommunityGroups` and `useJoinGroup` hooks already exist

### Implementation

**New Page: `/collectives`**

A dedicated hub for discovering and creating collectives (sub-communities).

| File | Action |
|------|--------|
| `src/pages/Collectives.tsx` | New - Main collectives discovery/creation page |
| `src/components/collectives/CreateCollectiveDialog.tsx` | New - Multi-step collective creation wizard |
| `src/components/collectives/CollectiveCard.tsx` | New - Display card for collectives |
| `src/hooks/useCollectives.ts` | New - Hooks for collective CRUD |
| `src/components/landing/PersonaCards.tsx` | Update - Change Collectives ctaAction to `/collectives` |
| `src/App.tsx` | Update - Add route |

**Page Structure:**

```text
┌────────────────────────────────────────┐
│  Header: "Collectives"                 │
│  Subtitle: Build your creative tribe   │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │  Start Your Collective CTA       │  │
│  │  [Create Collective]             │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  Tabs: [Discover] [My Collectives]     │
├────────────────────────────────────────┤
│  Topic Filter Pills:                   │
│  [All] [Models] [DJs] [Filmmakers]...  │
├────────────────────────────────────────┤
│  Collective Cards:                     │
│  ┌─────────────────────────────────┐   │
│  │ Avatar  Name         [Join]    │   │
│  │         Topic badge            │   │
│  │         XX members             │   │
│  │         Description...         │   │
│  └─────────────────────────────────┘   │
└────────────────────────────────────────┘
```

**Create Collective Dialog (Multi-step Wizard):**

```text
Step 1: Basics
┌────────────────────────────────────┐
│  Collective Name                   │
│  [___________________________]     │
│                                    │
│  Topic/Focus                       │
│  [Models ▼]                        │
│                                    │
│  Description                       │
│  [___________________________]     │
│  [___________________________]     │
└────────────────────────────────────┘

Step 2: Privacy & Access
┌────────────────────────────────────┐
│  Who can join?                     │
│  ○ Public - Anyone can join        │
│  ○ Discoverable - Request to join  │
│  ○ Private - Invite only           │
│                                    │
│  Max Members                       │
│  [100]                             │
└────────────────────────────────────┘

Step 3: Branding
┌────────────────────────────────────┐
│  Upload Avatar                     │
│  [+]                               │
│                                    │
│  Cover Image (optional)            │
│  [+]                               │
└────────────────────────────────────┘

Step 4: Invite Members
┌────────────────────────────────────┐
│  Search users to invite...         │
│  [___________________________]     │
│                                    │
│  Selected:                         │
│  [@user1] [@user2] [x]             │
└────────────────────────────────────┘
```

**Collective Topics (predefined):**
- Models
- Dancers
- DJs
- Filmmakers
- Photographers
- Musicians
- Travelers
- Writers
- Artists
- General

**Database Changes:**

Add topic enum and collective-specific fields:

```sql
-- Add collective topic enum
DO $$ BEGIN
  CREATE TYPE collective_topic AS ENUM (
    'models', 'dancers', 'djs', 'filmmakers', 
    'photographers', 'musicians', 'travelers', 
    'writers', 'artists', 'general'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add columns to conversations for collectives
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS
  cover_image_url TEXT,
  collective_topic collective_topic DEFAULT 'general',
  join_requests_enabled BOOLEAN DEFAULT false;

-- Create join requests table
CREATE TABLE IF NOT EXISTS collective_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- RLS for join requests
ALTER TABLE collective_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests" ON collective_join_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Collective admins can view requests" ON collective_join_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = collective_join_requests.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('owner', 'moderator')
    )
  );

CREATE POLICY "Users can create requests" ON collective_join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update requests" ON collective_join_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = collective_join_requests.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('owner', 'moderator')
    )
  );
```

---

## Summary of Changes

| Category | Files Changed |
|----------|---------------|
| New Pages | `BrandPartners.tsx`, `Collectives.tsx` |
| New Components | `CreateCollectiveDialog.tsx`, `CollectiveCard.tsx`, `BrandPartnerCard.tsx`, `BrandPartnerSheet.tsx`, `BrandApplicationDialog.tsx` |
| New Hooks | `useCollectives.ts` |
| Updated Hooks | `useBrandPartnerships.ts` |
| Updated Components | `PersonaCards.tsx` |
| Updated Config | `App.tsx` (routes) |
| Database | 2 migrations (brand_partnerships columns, collectives tables) |

---

## Technical Details

### useCollectives Hook

```typescript
// Key functions to implement:
- useCollectives(topic?: string) - List discoverable collectives
- useMyCollectives() - User's created/joined collectives
- useCreateCollective() - Create new collective
- useJoinRequestMutation() - Request to join
- useManageJoinRequest() - Approve/reject requests
```

### Brand Partners Hook Extension

```typescript
// Extended queries:
- useBrandPartnerships() - Already exists, enhance with filtering
- useFeaturedBrandPartners() - For homepage highlights
- useCreateBrandApplication() - New brand application flow
```

### Route Updates

```typescript
// Add to App.tsx routes:
<Route path="/brand-partners" element={<BrandPartners />} />
<Route path="/collectives" element={<Collectives />} />
```

### PersonaCards Navigation Updates

```typescript
// Update ctaAction values:
Brands: "/brand-partners"
Collectives: "/collectives"
```
