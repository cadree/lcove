

## Goal
Make Fan Challenge a real, working unlock path alongside purchase/subscription. Hybrid model: user self-confirms; optional proof upload; artists toggle on/off and configure.

## Current state (audit)
- `exclusive_access_rules` table already supports `rule_type='challenge'` with `label`, `description`, `metadata` — artists can already create a challenge rule via `AccessRuleEditor`.
- `useExclusiveTracks.hasAccess(trackId)` only checks `purchases` + `isSubscribedToArtist`. No challenge path.
- No `fan_challenge_completions` table.
- No completion modal / UI affordance on `ExclusiveTrackCard` for challenges.
- No counter, no proof upload, no revocation.

## Plan

### 1. Database (migration)
Create `fan_challenge_completions`:
- `id uuid pk`
- `user_id uuid` (completer)
- `artist_user_id uuid`
- `track_id uuid` (nullable → artist-wide challenge)
- `access_rule_id uuid` references `exclusive_access_rules`
- `challenge_type text` (instagram/tiktok/x/other)
- `proof_url text null`
- `proof_text text null`
- `verified boolean default true` (auto-verified unless requires_proof and pending review)
- `status text default 'completed'` (`completed` | `flagged` | `revoked`)
- `completed_at timestamptz default now()`
- `revoked_at timestamptz null`, `revoked_reason text null`
- unique `(user_id, access_rule_id)` to prevent duplicate unlocks

Indexes on `(user_id, track_id)` and `(artist_user_id, track_id)`.

RLS:
- SELECT: completer OR artist owner (via rule).
- INSERT: authenticated user inserting their own row, with valid active challenge rule.
- UPDATE: artist owner only (status, verified, revoked_at).
- DELETE: artist owner only.

Public counter via SECURITY DEFINER RPC `get_challenge_unlock_count(p_track_id uuid)` returning `bigint` — counts `status='completed'` rows.

Extend `exclusive_access_rules.metadata` usage (no schema change): `{ platform, instructions, requires_proof }`.

### 2. Storage
Reuse `media` bucket with path `${user.id}/challenge-proofs/...` (matches existing RLS path conventions).

### 3. Hooks
- New `src/hooks/useFanChallenges.ts`:
  - `useChallengeRule(artistUserId, trackId)` → returns active challenge rule (most specific track-level, fallback artist-level).
  - `useMyChallengeCompletions()` → user's `completed` & non-`revoked` rows.
  - `useChallengeUnlockCount(trackId)` → calls RPC.
  - `useCompleteChallenge()` mutation: upload proof if provided, insert row.
- Update `useExclusiveTracks.hasAccess(trackId)`: also true if `myCompletions` contains row matching `track_id` (or artist-wide rule) with `status='completed'`.

### 4. Components
- New `src/components/music/FanChallengeDialog.tsx`: shows instructions, platform icon, optional proof upload (image) + link/text field if `requires_proof`. "I completed this" CTA → calls mutation → success toast "You unlocked this by supporting the artist 💖".
- Update `src/components/music/ExclusiveTrackCard.tsx`:
  - When locked + challenge rule exists + payouts not strictly required for challenge: render secondary button "Unlock via Fan Challenge — Share on {platform}".
  - States: `locked` → `unlocking` (during mutation) → `unlocked` (with badge "Unlocked via Challenge").
  - Show challenge unlock counter "🎉 N fans unlocked via challenge" when count > 0.
- Update `AccessRuleEditor.tsx`: when `rule_type='challenge'`, expose fields:
  - Platform select (Instagram / TikTok / X / Other)
  - Instructions textarea (already exists as `description`)
  - `requires_proof` switch
  Persist into `metadata`.

### 5. Artist-side review (lightweight)
Add small "Challenge Unlocks" section in artist's exclusive music management view (existing `ExclusiveMusicSection` when `isOwner`):
- List recent completions with proof preview, Revoke button (sets `status='revoked'`).
- Defer full moderation queue.

### 6. Access integration recap
`hasAccess(trackId)` returns true if ANY:
- `isOwner`
- paid purchase exists
- active subscription to artist
- non-revoked completion matching track (or artist-wide rule)

Save / Add to profile / Download buttons already gate on `hasAccess` — automatic.

### 7. Files
**New**
- `supabase/migrations/<ts>_fan_challenges.sql`
- `src/hooks/useFanChallenges.ts`
- `src/components/music/FanChallengeDialog.tsx`

**Modified**
- `src/hooks/useExclusiveMusic.ts` (extend `hasAccess`)
- `src/components/music/ExclusiveTrackCard.tsx` (challenge button, states, counter, badge)
- `src/components/music/AccessRuleEditor.tsx` (challenge-specific fields)
- `src/components/music/ExclusiveMusicSection.tsx` (owner: recent challenge unlocks list with revoke)
- `src/integrations/supabase/types.ts` (auto-regen by migration)

### 8. Test checklist
1. Artist toggles on a challenge rule (Instagram, requires_proof=false).
2. Non-owner opens artist profile → sees locked track + "Unlock via Fan Challenge — Share on Instagram".
3. Click → modal → "I completed this" → toast → track flips to **Unlocked via Challenge** within 1s.
4. Refresh → still unlocked (DB-backed).
5. Counter increments to "1 fan unlocked via challenge".
6. Try again from same account → button hidden (already unlocked).
7. Artist sees completion, clicks Revoke → buyer's track relocks on next load.
8. Enable `requires_proof` → modal forces screenshot/link before submit.
9. Preview (15s) still works while locked.

