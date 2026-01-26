-- ============================================
-- ETHER Migration: Schema (Tables, Enums, Indexes)
-- Target: waafzlorvnozeujjhvxu
-- Generated: 2026-01-26
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE public.access_level AS ENUM ('level_1', 'level_2', 'level_3');

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TYPE public.creator_role_type AS ENUM (
  'model', 'chef', 'dj', 'dancer', 'filmmaker', 'photographer', 'musician', 'artist'
);

CREATE TYPE public.group_member_role AS ENUM ('owner', 'moderator', 'member');

CREATE TYPE public.group_visibility AS ENUM ('public', 'private', 'discoverable');

CREATE TYPE public.network_content_type AS ENUM ('short_film', 'feature_film', 'tv_show');

CREATE TYPE public.partner_category AS ENUM (
  'studio', 'venue', 'cafe', 'housing', 'equipment', 'transport', 'service', 'other'
);

CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');

-- ============================================
-- TABLES
-- ============================================

-- admin_actions
CREATE TABLE public.admin_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- admin_announcements
CREATE TABLE public.admin_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience JSONB NOT NULL DEFAULT '{"type": "all"}'::jsonb,
  sent_by UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ai_project_matches
CREATE TABLE public.ai_project_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  role_id UUID,
  match_score NUMERIC NOT NULL DEFAULT 0,
  match_reasons JSONB DEFAULT '[]'::jsonb,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- appointments
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  team_id UUID,
  contact_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- blog_posts
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- boards
CREATE TABLE public.boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Board',
  description TEXT,
  is_trashed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- board_members
CREATE TABLE public.board_members (
  board_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

-- board_items
CREATE TABLE public.board_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  content JSONB DEFAULT '{}'::jsonb,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  w DOUBLE PRECISION NOT NULL DEFAULT 200,
  h DOUBLE PRECISION NOT NULL DEFAULT 100,
  rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
  z_index INTEGER NOT NULL DEFAULT 0,
  parent_item_id UUID,
  start_item_id UUID,
  end_item_id UUID,
  start_anchor TEXT,
  end_anchor TEXT,
  stroke_color TEXT NOT NULL DEFAULT '#888888',
  stroke_width INTEGER NOT NULL DEFAULT 2,
  stroke_style TEXT NOT NULL DEFAULT 'solid',
  is_trashed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- board_item_comments
CREATE TABLE public.board_item_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- book_bookmarks
CREATE TABLE public.book_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_number INTEGER NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- book_highlights
CREATE TABLE public.book_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_number INTEGER NOT NULL,
  highlighted_text TEXT NOT NULL,
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- book_notes
CREATE TABLE public.book_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_number INTEGER NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- book_reading_progress
CREATE TABLE public.book_reading_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_page INTEGER NOT NULL DEFAULT 1,
  total_pages INTEGER NOT NULL DEFAULT 1,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- booking_pages
CREATE TABLE public.booking_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Book a Meeting',
  meeting_length_minutes INTEGER NOT NULL DEFAULT 30,
  availability JSONB NOT NULL DEFAULT '{}'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- booking_requests
CREATE TABLE public.booking_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_page_id UUID NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  requested_start TIMESTAMPTZ NOT NULL,
  requested_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  appointment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- brand_partnerships
CREATE TABLE public.brand_partnerships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL,
  brand_logo_url TEXT,
  description TEXT,
  website_url TEXT,
  partnership_type TEXT NOT NULL DEFAULT 'partner',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- calendar_reminders
CREATE TABLE public.calendar_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID,
  project_id UUID,
  personal_item_id UUID,
  reminder_time TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- calendar_tasks
CREATE TABLE public.calendar_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID,
  project_id UUID,
  personal_item_id UUID,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- community_updates
CREATE TABLE public.community_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contacts
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contact_contracts
CREATE TABLE public.contact_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  contract_number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  -- Provider info
  provider_name TEXT,
  provider_email TEXT,
  provider_phone TEXT,
  provider_address TEXT,
  -- Client info
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  -- Scope
  scope_description TEXT,
  deliverables TEXT,
  exclusions TEXT,
  client_responsibilities TEXT,
  -- Timeline
  project_start_date DATE,
  estimated_completion_date DATE,
  timeline_milestones TEXT,
  -- Payment
  total_price NUMERIC,
  payment_type TEXT,
  payment_schedule TEXT,
  payment_methods TEXT,
  late_fee_percentage NUMERIC,
  -- Revisions
  revisions_included INTEGER,
  revision_cost NUMERIC,
  -- Termination
  termination_terms TEXT,
  termination_notice_days INTEGER,
  early_termination_fee NUMERIC,
  refund_policy TEXT,
  -- Legal
  ownership_before_payment TEXT,
  ownership_after_payment TEXT,
  portfolio_rights BOOLEAN,
  confidentiality_enabled BOOLEAN,
  confidentiality_terms TEXT,
  confidentiality_duration TEXT,
  indemnification_terms TEXT,
  limitation_of_liability TEXT,
  force_majeure_enabled BOOLEAN,
  force_majeure_terms TEXT,
  governing_law_state TEXT,
  governing_law_country TEXT,
  -- Additional
  additional_parties JSONB,
  -- Signatures
  provider_signature_url TEXT,
  provider_signed_at TIMESTAMPTZ,
  client_signature_url TEXT,
  client_signed_at TIMESTAMPTZ,
  -- Sending
  recipient_email TEXT,
  recipient_phone TEXT,
  sent_via TEXT,
  sent_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contact_invoices
CREATE TABLE public.contact_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC,
  tax_amount NUMERIC,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  recipient_email TEXT,
  recipient_phone TEXT,
  sent_via TEXT,
  sent_at TIMESTAMPTZ,
  attached_images TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contact_media
CREATE TABLE public.contact_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contact_quotes
CREATE TABLE public.contact_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contact_tasks
CREATE TABLE public.contact_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contact_timeline
CREATE TABLE public.contact_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- content_genres
CREATE TABLE public.content_genres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- content_submissions
CREATE TABLE public.content_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL,
  submitter_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type public.network_content_type NOT NULL,
  video_url TEXT,
  external_video_url TEXT,
  trailer_url TEXT,
  cover_art_url TEXT,
  runtime_minutes INTEGER,
  director TEXT,
  cast_members TEXT[],
  credits JSONB,
  pitch_notes TEXT,
  status public.submission_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- conversations
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  topic TEXT,
  visibility public.group_visibility,
  max_members INTEGER,
  is_community_hub BOOLEAN DEFAULT false,
  project_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- conversation_participants
CREATE TABLE public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role public.group_member_role,
  project_role_name TEXT,
  is_muted BOOLEAN DEFAULT false,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- creative_roles
CREATE TABLE public.creative_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- creator_applications
CREATE TABLE public.creator_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  portfolio_url TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- creator_roles
CREATE TABLE public.creator_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role_type public.creator_role_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- creator_verifications
CREATE TABLE public.creator_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  verification_type TEXT NOT NULL DEFAULT 'standard',
  portfolio_urls TEXT[],
  social_links JSONB,
  badge_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- credit_contributions
CREATE TABLE public.credit_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contributor_id UUID NOT NULL,
  project_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- credit_earning_limits
CREATE TABLE public.credit_earning_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  daily_earned INTEGER NOT NULL DEFAULT 0,
  weekly_earned INTEGER NOT NULL DEFAULT 0,
  monthly_earned INTEGER NOT NULL DEFAULT 0,
  last_daily_reset TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_weekly_reset TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_monthly_reset TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- credit_ledger
CREATE TABLE public.credit_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  credit_type TEXT NOT NULL DEFAULT 'earned',
  genesis_amount INTEGER NOT NULL DEFAULT 0,
  earned_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- dance_videos
CREATE TABLE public.dance_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  is_featured BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- dj_mixes
CREATE TABLE public.dj_mixes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  cover_art_url TEXT,
  duration_seconds INTEGER,
  tracklist JSONB,
  genre TEXT,
  plays_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- energy_transactions
CREATE TABLE public.energy_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- escrow_holdings
CREATE TABLE public.escrow_holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  milestone_id UUID,
  contributor_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'held',
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- events
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_virtual BOOLEAN DEFAULT false,
  virtual_link TEXT,
  is_public BOOLEAN DEFAULT true,
  max_attendees INTEGER,
  ticket_price NUMERIC,
  ticket_currency TEXT DEFAULT 'USD',
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- event_rsvps
CREATE TABLE public.event_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'going',
  ticket_purchased BOOLEAN DEFAULT false,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- favorite_friends
CREATE TABLE public.favorite_friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- featured_creators
CREATE TABLE public.featured_creators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  featured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- fund_distributions
CREATE TABLE public.fund_distributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT NOT NULL,
  description TEXT,
  distributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stripe_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- group_expenses
CREATE TABLE public.group_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  split_type TEXT NOT NULL DEFAULT 'equal',
  is_settled BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- group_expense_contributions
CREATE TABLE public.group_expense_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- group_itineraries
CREATE TABLE public.group_itineraries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- home_preferences
CREATE TABLE public.home_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  pinned_items JSONB DEFAULT '[]'::jsonb,
  hidden_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- home_usage
CREATE TABLE public.home_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 1,
  last_clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- itinerary_items
CREATE TABLE public.itinerary_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  cost NUMERIC,
  currency TEXT DEFAULT 'USD',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- live_streams
CREATE TABLE public.live_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  stream_key TEXT,
  rtmp_url TEXT,
  playback_url TEXT,
  mux_live_stream_id TEXT,
  mux_playback_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  category TEXT,
  is_private BOOLEAN DEFAULT false,
  replay_url TEXT,
  replay_available BOOLEAN DEFAULT false,
  tips_enabled BOOLEAN DEFAULT true,
  total_tips NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- membership_contributions
CREATE TABLE public.membership_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  membership_id UUID NOT NULL,
  contribution_type TEXT NOT NULL DEFAULT 'monthly_fee',
  amount NUMERIC NOT NULL,
  platform_fee NUMERIC NOT NULL,
  treasury_amount NUMERIC NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- memberships
CREATE TABLE public.memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'inactive',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  monthly_contribution NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- menu_items
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  image_url TEXT,
  category TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  message_type TEXT DEFAULT 'text',
  is_system BOOLEAN DEFAULT false,
  reply_to_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- message_read_receipts
CREATE TABLE public.message_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- music_profiles
CREATE TABLE public.music_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_user_id TEXT,
  display_name TEXT,
  profile_url TEXT,
  image_url TEXT,
  top_tracks JSONB,
  currently_playing JSONB,
  embed_url TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- networks
CREATE TABLE public.networks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  is_public BOOLEAN DEFAULT true,
  subscription_price NUMERIC,
  subscription_currency TEXT DEFAULT 'USD',
  stripe_connect_account_id TEXT,
  payout_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- network_content
CREATE TABLE public.network_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type public.network_content_type NOT NULL,
  video_url TEXT,
  external_video_url TEXT,
  trailer_url TEXT,
  cover_art_url TEXT,
  runtime_minutes INTEGER,
  director TEXT,
  cast_members TEXT[],
  credits JSONB,
  is_published BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  subscriber_only BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- network_subscriptions
CREATE TABLE public.network_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(network_id, user_id)
);

-- newsletter_signups
CREATE TABLE public.newsletter_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notification_preferences
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  dm_notifications BOOLEAN DEFAULT true,
  event_notifications BOOLEAN DEFAULT true,
  project_notifications BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- partner_applications
CREATE TABLE public.partner_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  category public.partner_category NOT NULL,
  description TEXT,
  proposed_discount INTEGER,
  proposed_benefit TEXT,
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- partners
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  category public.partner_category NOT NULL,
  discount_percentage INTEGER,
  benefit_description TEXT,
  website_url TEXT,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- passions
CREATE TABLE public.passions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- payout_methods
CREATE TABLE public.payout_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'stripe_connect',
  stripe_account_id TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT true,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- payouts
CREATE TABLE public.payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_payout_id TEXT,
  stripe_transfer_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- personal_calendar_items
CREATE TABLE public.personal_calendar_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_all_day BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pipelines
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Pipeline',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pipeline_stages
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pipeline_items
CREATE TABLE public.pipeline_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL,
  stage_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  contact_id UUID,
  title TEXT NOT NULL,
  notes TEXT,
  priority INTEGER DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pipeline_events
CREATE TABLE public.pipeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- platform_reviews
CREATE TABLE public.platform_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  review_text TEXT,
  is_approved BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- platform_treasury
CREATE TABLE public.platform_treasury (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 0,
  total_contributions NUMERIC NOT NULL DEFAULT 0,
  total_distributions NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- portfolio_folders
CREATE TABLE public.portfolio_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- portfolio_items
CREATE TABLE public.portfolio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL,
  user_id UUID NOT NULL,
  media_type TEXT NOT NULL,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- posts
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  video_url TEXT,
  link_url TEXT,
  link_title TEXT,
  link_description TEXT,
  link_image TEXT,
  is_pinned BOOLEAN DEFAULT false,
  visibility TEXT DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- post_comments
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- post_likes
CREATE TABLE public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- post_reactions
CREATE TABLE public.post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, reaction_type)
);

-- profile_customizations
CREATE TABLE public.profile_customizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  layout JSONB DEFAULT '[]'::jsonb,
  theme_preset TEXT DEFAULT 'default',
  custom_css TEXT,
  font_family TEXT,
  background_type TEXT DEFAULT 'solid',
  background_value TEXT,
  accent_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- profiles
CREATE TABLE public.profiles (
  user_id UUID NOT NULL PRIMARY KEY,
  display_name TEXT,
  username TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  location TEXT,
  website TEXT,
  phone TEXT,
  city TEXT,
  mindset_level INTEGER DEFAULT 1,
  onboarding_completed BOOLEAN DEFAULT false,
  access_status TEXT DEFAULT 'pending',
  is_featured BOOLEAN DEFAULT false,
  featured_media_url TEXT,
  featured_media_type TEXT,
  show_in_directory BOOLEAN DEFAULT true,
  is_private BOOLEAN DEFAULT false,
  instagram_url TEXT,
  twitter_url TEXT,
  linkedin_url TEXT,
  tiktok_url TEXT,
  youtube_url TEXT,
  spotify_url TEXT,
  soundcloud_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- projects
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT DEFAULT 'public',
  location TEXT,
  budget NUMERIC,
  budget_currency TEXT DEFAULT 'USD',
  deadline TIMESTAMPTZ,
  energy_cost INTEGER DEFAULT 10,
  credits_pool INTEGER DEFAULT 0,
  credits_funded BOOLEAN DEFAULT false,
  escrow_enabled BOOLEAN DEFAULT false,
  ai_matching_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- project_applications
CREATE TABLE public.project_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  role_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  message TEXT,
  portfolio_links TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- project_milestones
CREATE TABLE public.project_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  credits_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- project_roles
CREATE TABLE public.project_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  skills_required TEXT[],
  slots_available INTEGER DEFAULT 1,
  slots_filled INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- push_subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- questionnaire_responses
CREATE TABLE public.questionnaire_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- rental_inquiries
CREATE TABLE public.rental_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT,
  proposed_date TIMESTAMPTZ,
  proposed_duration_hours INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reputation_scores
CREATE TABLE public.reputation_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  overall_score NUMERIC DEFAULT 0,
  review_score NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  completed_projects INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- saved_posts
CREATE TABLE public.saved_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- skills
CREATE TABLE public.skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- stores
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  is_active BOOLEAN DEFAULT true,
  stripe_connect_account_id TEXT,
  payout_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- store_item_categories
CREATE TABLE public.store_item_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- store_items
CREATE TABLE public.store_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  category_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_rental BOOLEAN DEFAULT false,
  rental_duration_hours INTEGER,
  max_quantity INTEGER,
  stripe_price_id TEXT,
  item_type TEXT DEFAULT 'product',
  booking_enabled BOOLEAN DEFAULT false,
  booking_duration_minutes INTEGER,
  booking_buffer_minutes INTEGER DEFAULT 0,
  booking_availability JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- store_orders
CREATE TABLE public.store_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  quantity INTEGER DEFAULT 1,
  total_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  stripe_payment_id TEXT,
  rental_start TIMESTAMPTZ,
  rental_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- stories
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- story_reactions
CREATE TABLE public.story_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT '❤️',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- story_views
CREATE TABLE public.story_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

-- stream_reactions
CREATE TABLE public.stream_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- stream_tips
CREATE TABLE public.stream_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL,
  tipper_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  message TEXT,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- stream_viewers
CREATE TABLE public.stream_viewers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE(stream_id, user_id)
);

-- studio_bookings
CREATE TABLE public.studio_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  stripe_payment_id TEXT,
  total_amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- studio_reviews
CREATE TABLE public.studio_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- teams
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- team_members
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- transactions
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tv_seasons
CREATE TABLE public.tv_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL,
  season_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  cover_art_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tv_episodes
CREATE TABLE public.tv_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  external_video_url TEXT,
  thumbnail_url TEXT,
  runtime_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- typing_indicators
CREATE TABLE public.typing_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  is_typing BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- user_blocks
CREATE TABLE public.user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- user_creative_roles
CREATE TABLE public.user_creative_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- user_credits
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  genesis_balance INTEGER NOT NULL DEFAULT 0,
  earned_balance INTEGER NOT NULL DEFAULT 0,
  genesis_lifetime_minted INTEGER NOT NULL DEFAULT 0,
  genesis_burned INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_energy
CREATE TABLE public.user_energy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_energy INTEGER NOT NULL DEFAULT 100,
  max_energy INTEGER NOT NULL DEFAULT 100,
  last_regen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_passions
CREATE TABLE public.user_passions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  passion_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, passion_id)
);

-- user_reviews
CREATE TABLE public.user_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id UUID NOT NULL,
  reviewed_user_id UUID NOT NULL,
  project_id UUID,
  rating INTEGER NOT NULL,
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- user_skills
CREATE TABLE public.user_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

-- watch_history
CREATE TABLE public.watch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  episode_id UUID,
  progress_seconds INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id, episode_id)
);

-- ============================================
-- INDEXES (non-primary key)
-- ============================================

CREATE INDEX idx_admin_actions_target ON admin_actions(target_user_id);
CREATE INDEX idx_ai_project_matches_user ON ai_project_matches(user_id, is_dismissed);
CREATE INDEX idx_appointments_owner_starts ON appointments(owner_user_id, starts_at);
CREATE INDEX idx_appointments_team_starts ON appointments(team_id, starts_at);
CREATE INDEX idx_appointments_contact ON appointments(contact_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_blog_posts_user_id ON blog_posts(user_id);
CREATE INDEX idx_blog_posts_published ON blog_posts(is_published, published_at DESC);
CREATE INDEX idx_board_items_start_item ON board_items(board_id, start_item_id);
CREATE INDEX idx_board_items_end_item ON board_items(board_id, end_item_id);
CREATE INDEX idx_booking_pages_owner_active ON booking_pages(owner_user_id, is_active);
CREATE INDEX idx_booking_pages_slug ON booking_pages(slug);
CREATE INDEX idx_booking_requests_page_created ON booking_requests(booking_page_id, created_at DESC);
CREATE INDEX idx_calendar_reminders_user ON calendar_reminders(user_id, reminder_time);
CREATE INDEX idx_calendar_tasks_user ON calendar_tasks(user_id);
CREATE INDEX idx_community_updates_published ON community_updates(is_published, published_at DESC);
CREATE INDEX idx_contacts_owner ON contacts(owner_user_id);
CREATE INDEX idx_contact_contracts_pipeline ON contact_contracts(pipeline_item_id);
CREATE INDEX idx_contact_invoices_pipeline ON contact_invoices(pipeline_item_id);
CREATE INDEX idx_contact_media_pipeline ON contact_media(pipeline_item_id);
CREATE INDEX idx_contact_quotes_pipeline ON contact_quotes(pipeline_item_id);
CREATE INDEX idx_contact_tasks_pipeline ON contact_tasks(pipeline_item_id);
CREATE INDEX idx_contact_timeline_contact ON contact_timeline(contact_id);
CREATE INDEX idx_content_submissions_network ON content_submissions(network_id, status);
CREATE INDEX idx_conversation_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_creator_roles_user ON creator_roles(user_id);
CREATE INDEX idx_creator_verifications_user ON creator_verifications(user_id);
CREATE INDEX idx_credit_ledger_user ON credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_energy_transactions_user ON energy_transactions(user_id, created_at DESC);
CREATE INDEX idx_escrow_holdings_project ON escrow_holdings(project_id);
CREATE INDEX idx_events_creator ON events(creator_id);
CREATE INDEX idx_events_starts ON events(starts_at);
CREATE INDEX idx_events_public ON events(is_public, starts_at);
CREATE INDEX idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON event_rsvps(user_id);
CREATE INDEX idx_featured_creators_order ON featured_creators(display_order);
CREATE INDEX idx_fund_distributions_user ON fund_distributions(user_id);
CREATE INDEX idx_group_expenses_conv ON group_expenses(conversation_id);
CREATE INDEX idx_group_expense_contributions_expense ON group_expense_contributions(expense_id);
CREATE INDEX idx_group_itineraries_conv ON group_itineraries(conversation_id);
CREATE INDEX idx_itinerary_items_itinerary ON itinerary_items(itinerary_id);
CREATE INDEX idx_live_streams_user ON live_streams(user_id);
CREATE INDEX idx_live_streams_status ON live_streams(status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_network_content_network ON network_content(network_id);
CREATE INDEX idx_network_subscriptions_network ON network_subscriptions(network_id);
CREATE INDEX idx_network_subscriptions_user ON network_subscriptions(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_partners_category ON partners(category, is_active);
CREATE INDEX idx_personal_calendar_items_user ON personal_calendar_items(user_id, starts_at);
CREATE INDEX idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
CREATE INDEX idx_pipeline_items_pipeline ON pipeline_items(pipeline_id);
CREATE INDEX idx_pipeline_items_stage ON pipeline_items(stage_id);
CREATE INDEX idx_pipeline_events_item ON pipeline_events(pipeline_item_id);
CREATE INDEX idx_portfolio_folders_user ON portfolio_folders(user_id);
CREATE INDEX idx_portfolio_items_folder ON portfolio_items(folder_id);
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_post_likes_post ON post_likes(post_id);
CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_access ON profiles(access_status);
CREATE INDEX idx_profiles_directory ON profiles(show_in_directory, display_name);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_applications_project ON project_applications(project_id);
CREATE INDEX idx_project_applications_applicant ON project_applications(applicant_id);
CREATE INDEX idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX idx_project_roles_project ON project_roles(project_id);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_saved_posts_user ON saved_posts(user_id);
CREATE INDEX idx_store_items_store ON store_items(store_id);
CREATE INDEX idx_store_orders_item ON store_orders(item_id);
CREATE INDEX idx_store_orders_buyer ON store_orders(buyer_id);
CREATE INDEX idx_stories_user ON stories(user_id);
CREATE INDEX idx_stories_expires ON stories(expires_at);
CREATE INDEX idx_story_views_story ON story_views(story_id);
CREATE INDEX idx_stream_tips_stream ON stream_tips(stream_id);
CREATE INDEX idx_stream_viewers_stream ON stream_viewers(stream_id);
CREATE INDEX idx_studio_bookings_item ON studio_bookings(item_id);
CREATE INDEX idx_studio_bookings_user ON studio_bookings(user_id);
CREATE INDEX idx_studio_reviews_item ON studio_reviews(item_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_tv_seasons_content ON tv_seasons(content_id);
CREATE INDEX idx_tv_episodes_season ON tv_episodes(season_id);
CREATE INDEX idx_user_creative_roles_user ON user_creative_roles(user_id);
CREATE INDEX idx_user_passions_user ON user_passions(user_id);
CREATE INDEX idx_user_reviews_reviewed ON user_reviews(reviewed_user_id);
CREATE INDEX idx_user_skills_user ON user_skills(user_id);
CREATE INDEX idx_watch_history_user ON watch_history(user_id);
CREATE INDEX idx_watch_history_content ON watch_history(content_id);

-- ============================================
-- FOREIGN KEYS
-- ============================================

-- ai_project_matches
ALTER TABLE ai_project_matches ADD CONSTRAINT ai_project_matches_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE ai_project_matches ADD CONSTRAINT ai_project_matches_role_id_fkey FOREIGN KEY (role_id) REFERENCES project_roles(id) ON DELETE SET NULL;

-- appointments
ALTER TABLE appointments ADD CONSTRAINT appointments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD CONSTRAINT appointments_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- board_items
ALTER TABLE board_items ADD CONSTRAINT board_items_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;
ALTER TABLE board_items ADD CONSTRAINT board_items_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES board_items(id) ON DELETE SET NULL;
ALTER TABLE board_items ADD CONSTRAINT board_items_start_item_id_fkey FOREIGN KEY (start_item_id) REFERENCES board_items(id) ON DELETE SET NULL;
ALTER TABLE board_items ADD CONSTRAINT board_items_end_item_id_fkey FOREIGN KEY (end_item_id) REFERENCES board_items(id) ON DELETE SET NULL;

-- board_item_comments
ALTER TABLE board_item_comments ADD CONSTRAINT board_item_comments_board_item_id_fkey FOREIGN KEY (board_item_id) REFERENCES board_items(id) ON DELETE CASCADE;

-- board_members
ALTER TABLE board_members ADD CONSTRAINT board_members_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

-- booking_requests
ALTER TABLE booking_requests ADD CONSTRAINT booking_requests_booking_page_id_fkey FOREIGN KEY (booking_page_id) REFERENCES booking_pages(id) ON DELETE CASCADE;
ALTER TABLE booking_requests ADD CONSTRAINT booking_requests_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

-- calendar_reminders
ALTER TABLE calendar_reminders ADD CONSTRAINT calendar_reminders_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE calendar_reminders ADD CONSTRAINT calendar_reminders_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE calendar_reminders ADD CONSTRAINT calendar_reminders_personal_item_id_fkey FOREIGN KEY (personal_item_id) REFERENCES personal_calendar_items(id) ON DELETE CASCADE;

-- calendar_tasks
ALTER TABLE calendar_tasks ADD CONSTRAINT calendar_tasks_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE calendar_tasks ADD CONSTRAINT calendar_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE calendar_tasks ADD CONSTRAINT calendar_tasks_personal_item_id_fkey FOREIGN KEY (personal_item_id) REFERENCES personal_calendar_items(id) ON DELETE CASCADE;

-- contact_contracts
ALTER TABLE contact_contracts ADD CONSTRAINT contact_contracts_pipeline_item_id_fkey FOREIGN KEY (pipeline_item_id) REFERENCES pipeline_items(id) ON DELETE CASCADE;

-- contact_invoices
ALTER TABLE contact_invoices ADD CONSTRAINT contact_invoices_pipeline_item_id_fkey FOREIGN KEY (pipeline_item_id) REFERENCES pipeline_items(id) ON DELETE CASCADE;

-- contact_media
ALTER TABLE contact_media ADD CONSTRAINT contact_media_pipeline_item_id_fkey FOREIGN KEY (pipeline_item_id) REFERENCES pipeline_items(id) ON DELETE CASCADE;

-- contact_quotes
ALTER TABLE contact_quotes ADD CONSTRAINT contact_quotes_pipeline_item_id_fkey FOREIGN KEY (pipeline_item_id) REFERENCES pipeline_items(id) ON DELETE CASCADE;

-- contact_tasks
ALTER TABLE contact_tasks ADD CONSTRAINT contact_tasks_pipeline_item_id_fkey FOREIGN KEY (pipeline_item_id) REFERENCES pipeline_items(id) ON DELETE CASCADE;

-- contact_timeline
ALTER TABLE contact_timeline ADD CONSTRAINT contact_timeline_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

-- content_submissions
ALTER TABLE content_submissions ADD CONSTRAINT content_submissions_network_id_fkey FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE;

-- conversation_participants
ALTER TABLE conversation_participants ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- conversations
ALTER TABLE conversations ADD CONSTRAINT conversations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- credit_contributions
ALTER TABLE credit_contributions ADD CONSTRAINT credit_contributions_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- escrow_holdings
ALTER TABLE escrow_holdings ADD CONSTRAINT escrow_holdings_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE escrow_holdings ADD CONSTRAINT escrow_holdings_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL;

-- event_rsvps
ALTER TABLE event_rsvps ADD CONSTRAINT event_rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- group_expenses
ALTER TABLE group_expenses ADD CONSTRAINT group_expenses_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- group_expense_contributions
ALTER TABLE group_expense_contributions ADD CONSTRAINT group_expense_contributions_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES group_expenses(id) ON DELETE CASCADE;

-- group_itineraries
ALTER TABLE group_itineraries ADD CONSTRAINT group_itineraries_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- itinerary_items
ALTER TABLE itinerary_items ADD CONSTRAINT itinerary_items_itinerary_id_fkey FOREIGN KEY (itinerary_id) REFERENCES group_itineraries(id) ON DELETE CASCADE;

-- membership_contributions
ALTER TABLE membership_contributions ADD CONSTRAINT membership_contributions_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE;

-- messages
ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;

-- message_read_receipts
ALTER TABLE message_read_receipts ADD CONSTRAINT message_read_receipts_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

-- network_content
ALTER TABLE network_content ADD CONSTRAINT network_content_network_id_fkey FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE;

-- network_subscriptions
ALTER TABLE network_subscriptions ADD CONSTRAINT network_subscriptions_network_id_fkey FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE;

-- partners
ALTER TABLE partners ADD CONSTRAINT partners_application_id_fkey FOREIGN KEY (application_id) REFERENCES partner_applications(id) ON DELETE SET NULL;

-- pipeline_stages
ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;

-- pipeline_items
ALTER TABLE pipeline_items ADD CONSTRAINT pipeline_items_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;
ALTER TABLE pipeline_items ADD CONSTRAINT pipeline_items_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE CASCADE;
ALTER TABLE pipeline_items ADD CONSTRAINT pipeline_items_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

-- pipeline_events
ALTER TABLE pipeline_events ADD CONSTRAINT pipeline_events_pipeline_item_id_fkey FOREIGN KEY (pipeline_item_id) REFERENCES pipeline_items(id) ON DELETE CASCADE;

-- portfolio_items
ALTER TABLE portfolio_items ADD CONSTRAINT portfolio_items_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES portfolio_folders(id) ON DELETE CASCADE;

-- post_comments
ALTER TABLE post_comments ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE post_comments ADD CONSTRAINT post_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES post_comments(id) ON DELETE CASCADE;

-- post_likes
ALTER TABLE post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

-- post_reactions
ALTER TABLE post_reactions ADD CONSTRAINT post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

-- project_applications
ALTER TABLE project_applications ADD CONSTRAINT project_applications_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE project_applications ADD CONSTRAINT project_applications_role_id_fkey FOREIGN KEY (role_id) REFERENCES project_roles(id) ON DELETE CASCADE;

-- project_milestones
ALTER TABLE project_milestones ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- project_roles
ALTER TABLE project_roles ADD CONSTRAINT project_roles_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- rental_inquiries
ALTER TABLE rental_inquiries ADD CONSTRAINT rental_inquiries_studio_item_id_fkey FOREIGN KEY (studio_item_id) REFERENCES store_items(id) ON DELETE CASCADE;

-- saved_posts
ALTER TABLE saved_posts ADD CONSTRAINT saved_posts_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

-- store_item_categories
ALTER TABLE store_item_categories ADD CONSTRAINT store_item_categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- store_items
ALTER TABLE store_items ADD CONSTRAINT store_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE store_items ADD CONSTRAINT store_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES store_item_categories(id) ON DELETE SET NULL;

-- store_orders
ALTER TABLE store_orders ADD CONSTRAINT store_orders_item_id_fkey FOREIGN KEY (item_id) REFERENCES store_items(id) ON DELETE CASCADE;

-- stories
ALTER TABLE stories ADD CONSTRAINT stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- story_reactions
ALTER TABLE story_reactions ADD CONSTRAINT story_reactions_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;

-- story_views
ALTER TABLE story_views ADD CONSTRAINT story_views_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;

-- stream_reactions
ALTER TABLE stream_reactions ADD CONSTRAINT stream_reactions_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE;

-- stream_tips
ALTER TABLE stream_tips ADD CONSTRAINT stream_tips_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE;

-- stream_viewers
ALTER TABLE stream_viewers ADD CONSTRAINT stream_viewers_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE;

-- studio_bookings
ALTER TABLE studio_bookings ADD CONSTRAINT studio_bookings_item_id_fkey FOREIGN KEY (item_id) REFERENCES store_items(id) ON DELETE CASCADE;

-- studio_reviews
ALTER TABLE studio_reviews ADD CONSTRAINT studio_reviews_item_id_fkey FOREIGN KEY (item_id) REFERENCES store_items(id) ON DELETE CASCADE;

-- team_members
ALTER TABLE team_members ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

-- tv_seasons
ALTER TABLE tv_seasons ADD CONSTRAINT tv_seasons_content_id_fkey FOREIGN KEY (content_id) REFERENCES network_content(id) ON DELETE CASCADE;

-- tv_episodes
ALTER TABLE tv_episodes ADD CONSTRAINT tv_episodes_season_id_fkey FOREIGN KEY (season_id) REFERENCES tv_seasons(id) ON DELETE CASCADE;

-- user_creative_roles
ALTER TABLE user_creative_roles ADD CONSTRAINT user_creative_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES creative_roles(id) ON DELETE CASCADE;

-- user_passions
ALTER TABLE user_passions ADD CONSTRAINT user_passions_passion_id_fkey FOREIGN KEY (passion_id) REFERENCES passions(id) ON DELETE CASCADE;

-- user_reviews
ALTER TABLE user_reviews ADD CONSTRAINT user_reviews_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- user_skills
ALTER TABLE user_skills ADD CONSTRAINT user_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;

-- watch_history
ALTER TABLE watch_history ADD CONSTRAINT watch_history_content_id_fkey FOREIGN KEY (content_id) REFERENCES network_content(id) ON DELETE CASCADE;
ALTER TABLE watch_history ADD CONSTRAINT watch_history_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES tv_episodes(id) ON DELETE SET NULL;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_project_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_earning_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE dance_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dj_mixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_expense_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE passions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_creative_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_energy ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_passions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
