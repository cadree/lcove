

## What's actually happening

**Bug found**: The "static Fan Challenge text" you're seeing is in the **artist-side** "🎯 Recent Challenge Unlocks" panel header — it's a label, not a CTA. The real fan-facing CTA is the **"Unlock — Free for fans" / "Unlock via Challenge — Share on Instagram"** button on each track card. If you're not seeing a clickable button, it's because either (a) no track on that profile has an active `challenge` rule, or (b) you're viewing your own profile (owner sees Publish/Delete instead).

**Action**: I'll keep the existing per-track unlock flow as-is (it works), and add a brand-new standalone Challenges product alongside it.

---

## Plan: Standalone Creator Challenges (new product)

### 1. Database (new tables)

```sql
-- Challenges created by any user
CREATE TABLE public.challenges (
  id uuid PK,
  creator_id uuid REFERENCES auth.users,
  title text NOT NULL,
  description text,
  rules text,                       -- markdown / plain
  reward_credits integer DEFAULT 0,
  cost_credits integer DEFAULT 0,   -- 0 = free to join
  deadline timestamptz,
  cover_image_url text,
  is_active boolean DEFAULT true,
  is_published boolean DEFAULT false,
  participant_count integer DEFAULT 0,
  created_at, updated_at
);

-- Participation
CREATE TABLE public.challenge_participants (
  id uuid PK,
  challenge_id uuid REFERENCES challenges ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

-- Submissions
CREATE TABLE public.challenge_submissions (
  id uuid PK,
  challenge_id uuid REFERENCES challenges,
  user_id uuid,
  submission_url text,        -- link OR uploaded media URL
  submission_text text,
  status text DEFAULT 'submitted',  -- submitted | approved | rejected | rewarded
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (challenge_id, user_id)
);
```

**RLS**:
- `challenges` SELECT: anyone if `is_published=true`; creator always.
- `challenges` INSERT/UPDATE/DELETE: creator only.
- `challenge_participants` SELECT: self or challenge creator. INSERT: self (only on published+active challenges where deadline not past). DELETE: self.
- `challenge_submissions` SELECT: self or challenge creator. INSERT: self (only if participant exists). UPDATE: creator (to mark approved/rewarded).

### 2. Profile integration
On `ProfileHeader` (or new `ProfileChallengesSection`), fetch the profile owner's most recent active+published challenge and render a **clickable card** (`ChallengeProfileCard`) with title, reward, deadline, participant count → links to `/challenge/:id`. If no active challenge, render nothing for visitors; show "Create your first challenge" for owner.

### 3. New routes & pages
- `/challenges` — discovery feed of all active published challenges.
- `/challenge/:id` — `ChallengeDetail.tsx`: hero, description, rules, reward, deadline, creator card, CTA logic:
  - Not signed in → "Sign in to join"
  - Past deadline / `!is_active` → "Challenge Closed" (disabled)
  - Not joined → **"Join Challenge"** (free instant; or `cost_credits>0` → confirm dialog → deduct via existing `transfer-credits`/credit ledger)
  - Joined, no submission → **"Submit Entry"** opens `SubmitEntryDialog` (file upload to `media/{user_id}/challenge-submissions/...` or paste link + optional text)
  - Submitted → "Submitted ✓" + view-my-entry link

### 4. Creator tools
- `CreateChallengeDialog` reachable from profile + `/challenges` (FAB for owner).
- Creator panel inside `/challenge/:id` for owner: list of submissions with Approve / Reward (mints earned credits via existing economy) / Reject buttons.

### 5. Hooks
- `useChallenges.ts` — list, by-id, by-creator, create, update, delete.
- `useChallengeParticipation.ts` — join, my-participation, my-submission, submit-entry, list-submissions (owner).

### 6. Files added/changed
**New**:
- `src/pages/ChallengeDetail.tsx`, `src/pages/Challenges.tsx`
- `src/components/challenges/ChallengeProfileCard.tsx`
- `src/components/challenges/CreateChallengeDialog.tsx`
- `src/components/challenges/SubmitEntryDialog.tsx`
- `src/components/challenges/ChallengeSubmissionsPanel.tsx`
- `src/hooks/useChallenges.ts`, `src/hooks/useChallengeParticipation.ts`
- Migration: `challenges`, `challenge_participants`, `challenge_submissions` + RLS + trigger to bump `participant_count`.

**Edited**:
- `src/App.tsx` — register `/challenges` and `/challenge/:id` routes.
- `src/pages/Profile.tsx` (or `ProfileHeader.tsx`) — mount `ChallengeProfileCard`.

### 7. Test plan
1. Owner creates a challenge from profile → card appears, links to `/challenge/:id`.
2. Sign in as different user → click card → see full detail → click **Join Challenge** → state flips to **Submit Entry**.
3. Click Submit → upload file or paste link → state flips to **Submitted**.
4. Owner views submissions panel → approves one → submitter receives credits.
5. Set `is_active=false` or pass deadline → CTA shows **Challenge Closed**.
6. Hard refresh on every step → state persists (DB-backed).

