

# Restructured Music Profile + Exclusive Music Monetization

## Overview

Simplify the Connect Music Dialog to four core fields (Artist Name, Artist Image, Spotify URL, Apple Music URL), and add a new **Exclusive Music** system where artists can upload tracks, set access rules (one-time purchase, page subscription, or custom fan challenges), and receive 100% of revenue through their Stripe Connect account.

---

## Part 1: Simplified Connect Music Dialog

**Current state**: 4-tab dialog (Links, Tracks, Albums, Latest) with genres, manual track/album entry, and URL fields.

**New structure**: Single clean form with:
- Artist / Band Name (required)
- Artist Image (upload from gallery or auto-pulled from URL)
- Spotify Artist URL (auto-fetches name + image if empty)
- Apple Music Artist URL (same auto-fetch)

Remove: Genres section, Tracks tab, Albums tab, Latest Release tab from the Connect dialog. The public profile block (`MusicProfileBlock`) will still show platform links and the artist image but no longer manually-entered tracks/albums/genres.

---

## Part 2: Exclusive Music Upload & Monetization

### New DB Table: `exclusive_tracks`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| artist_user_id | UUID FK profiles | Owner |
| title | TEXT | Track name |
| cover_image_url | TEXT | Cover art |
| audio_file_url | TEXT | Stored in `media` bucket |
| preview_clip_url | TEXT | Optional 30s preview (free) |
| duration_seconds | INT | |
| access_type | TEXT | 'purchase', 'subscription', 'custom' |
| price_cents | INT | One-time price (if purchase) |
| description | TEXT | Artist notes |
| is_published | BOOL | |
| created_at, updated_at | TIMESTAMPTZ | |

### New DB Table: `exclusive_access_rules`
Customizable unlock conditions per track or globally for the artist.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| artist_user_id | UUID FK | |
| track_id | UUID FK nullable | NULL = applies to all tracks |
| rule_type | TEXT | 'subscription', 'purchase', 'challenge', 'tip_goal', 'share_unlock' |
| label | TEXT | Custom label (e.g. "Share on 3 platforms to unlock") |
| description | TEXT | Fun description by artist |
| amount_cents | INT | For purchase/subscription/tip rules |
| interval | TEXT | 'monthly'/'yearly' for subscriptions |
| metadata | JSONB | Flexible config (share count, challenge details) |
| sort_order | INT | Display order |
| is_active | BOOL | |

### New DB Table: `exclusive_track_purchases`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| track_id | UUID FK | |
| buyer_user_id | UUID FK | |
| access_rule_id | UUID FK | Which rule granted access |
| stripe_payment_intent_id | TEXT | |
| amount_cents | INT | |
| created_at | TIMESTAMPTZ | |

### New DB Table: `artist_subscriptions`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| artist_user_id | UUID FK | |
| subscriber_user_id | UUID FK | |
| stripe_subscription_id | TEXT | |
| status | TEXT | active/canceled/past_due |
| amount_cents | INT | |
| interval | TEXT | monthly/yearly |
| created_at, updated_at | TIMESTAMPTZ | |

### Payment Flow
- Uses existing Stripe Connect infrastructure (artists already have `create-connect-account` / `check-connect-status`)
- New edge function: `purchase-exclusive-track` — creates a Stripe PaymentIntent with `transfer_data.destination` set to the artist's Connect account (100% to artist, 0% platform fee per revenue split memory)
- New edge function: `create-artist-subscription` — creates a Stripe subscription checkout with the artist as the connected account destination

### UI Components

**For Artists (owner view):**
- New "Exclusive Music" section in profile with upload dialog
- Upload tracks (audio file + cover art + title)
- Set access rules per track: one-time price, subscription, or custom challenges
- Custom challenges section: artist writes fun unlock conditions (share goals, tip jars, fan milestones)
- Highly customizable — artist can add/remove/reorder rules, write playful descriptions, set emoji icons

**For Fans (visitor view):**
- Locked track cards with cover art and 30s preview button
- Clear unlock options displayed per track
- Purchase button → Stripe checkout → instant access
- Subscribe button → monthly subscription → access all exclusive tracks
- Custom challenge progress indicators

---

## Files to Create
- DB migration for `exclusive_tracks`, `exclusive_access_rules`, `exclusive_track_purchases`, `artist_subscriptions` tables with RLS
- `src/components/music/ExclusiveMusicSection.tsx` — artist upload + management UI
- `src/components/music/ExclusiveTrackCard.tsx` — fan-facing locked/unlocked track card
- `src/components/music/AccessRuleEditor.tsx` — customizable rule builder for artists
- `src/hooks/useExclusiveMusic.ts` — CRUD for exclusive tracks and access rules
- `supabase/functions/purchase-exclusive-track/index.ts` — Stripe payment for track purchase
- `supabase/functions/create-artist-subscription/index.ts` — Stripe subscription for artist page

## Files to Modify
- `src/components/music/ConnectMusicDialog.tsx` — Strip down to 4 fields only
- `src/components/music/MusicProfileBlock.tsx` — Remove tracks/albums/genres display, add Exclusive Music section
- `src/hooks/useMusicProfile.ts` — Simplify interface (remove tracks/albums/genres/latest_release)
- `src/components/profile/CreatorModuleTabs.tsx` or Profile page — Add Exclusive Music tab/section

