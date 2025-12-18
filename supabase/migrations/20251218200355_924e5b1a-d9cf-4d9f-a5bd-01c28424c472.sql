
-- Create app_role enum for admin/governance
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table for role-based access
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create group_chat_type enum
CREATE TYPE public.group_visibility AS ENUM ('public', 'private', 'discoverable');
CREATE TYPE public.group_member_role AS ENUM ('owner', 'moderator', 'member');

-- Enhance conversations table with community hub features
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS visibility public.group_visibility DEFAULT 'private',
ADD COLUMN IF NOT EXISTS topic text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS max_members integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_community_hub boolean DEFAULT false;

-- Add role to conversation_participants
ALTER TABLE public.conversation_participants
ADD COLUMN IF NOT EXISTS role public.group_member_role DEFAULT 'member';

-- Group funding/expenses table
CREATE TABLE public.group_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  total_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_expenses ENABLE ROW LEVEL SECURITY;

-- Group expense contributions
CREATE TABLE public.group_expense_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid REFERENCES public.group_expenses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  amount_owed numeric NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_expense_contributions ENABLE ROW LEVEL SECURITY;

-- Group itinerary
CREATE TABLE public.group_itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_itineraries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid REFERENCES public.group_itineraries(id) ON DELETE CASCADE NOT NULL,
  day_number integer NOT NULL,
  start_time time,
  end_time time,
  title text NOT NULL,
  description text,
  location text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;

-- Partnership categories enum
CREATE TYPE public.partner_category AS ENUM ('studio', 'venue', 'cafe', 'housing', 'equipment', 'transport', 'service', 'other');

-- Partners table (expanded from brand_partnerships concept)
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category public.partner_category NOT NULL,
  description text,
  logo_url text,
  cover_image_url text,
  address text,
  city text,
  state text,
  country text DEFAULT 'USA',
  latitude numeric,
  longitude numeric,
  website_url text,
  contact_email text,
  contact_phone text,
  member_benefits text,
  terms text,
  is_active boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false,
  owner_user_id uuid,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Creator role modules (for profile tabs)
CREATE TYPE public.creator_role_type AS ENUM ('model', 'chef', 'dj', 'dancer', 'filmmaker', 'photographer', 'musician', 'artist');

CREATE TABLE public.creator_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_type public.creator_role_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_type)
);
ALTER TABLE public.creator_roles ENABLE ROW LEVEL SECURITY;

-- Portfolio items for models/photographers
CREATE TABLE public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  description text,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  tags text[],
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Menu items for chefs
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric,
  image_url text,
  category text,
  is_available boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Mixes for DJs
CREATE TABLE public.dj_mixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  audio_url text,
  cover_art_url text,
  duration_seconds integer,
  genre text,
  is_live boolean NOT NULL DEFAULT false,
  recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dj_mixes ENABLE ROW LEVEL SECURITY;

-- Dance videos for dancers
CREATE TABLE public.dance_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumbnail_url text,
  style text,
  song_title text,
  song_artist text,
  is_choreography boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dance_videos ENABLE ROW LEVEL SECURITY;

-- User reviews
CREATE TABLE public.user_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL,
  reviewed_user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  content text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, reviewed_user_id, project_id)
);
ALTER TABLE public.user_reviews ENABLE ROW LEVEL SECURITY;

-- Virtual events enhancement
ALTER TABLE public.live_streams
ADD COLUMN IF NOT EXISTS is_virtual_event boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS event_type text,
ADD COLUMN IF NOT EXISTS max_attendees integer,
ADD COLUMN IF NOT EXISTS requires_ticket boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ticket_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS replay_available boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS replay_url text,
ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES public.live_streams(id);

-- Community updates/announcements
CREATE TABLE public.community_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'announcement' CHECK (category IN ('announcement', 'spotlight', 'update', 'transparency')),
  image_url text,
  is_pinned boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_updates ENABLE ROW LEVEL SECURITY;

-- Admin actions log
CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('suspend', 'unsuspend', 'warn', 'remove', 'approve_onboarding', 'deny_onboarding', 'override')),
  target_user_id uuid NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Add suspension fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
ADD COLUMN IF NOT EXISTS suspension_reason text,
ADD COLUMN IF NOT EXISTS onboarding_score integer,
ADD COLUMN IF NOT EXISTS onboarding_level integer CHECK (onboarding_level IN (1, 2, 3));

-- RLS Policies

-- Group expenses
CREATE POLICY "Participants can view group expenses" ON public.group_expenses FOR SELECT
USING (is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Owner/mods can manage expenses" ON public.group_expenses FOR ALL
USING (EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = group_expenses.conversation_id
  AND cp.user_id = auth.uid()
  AND cp.role IN ('owner', 'moderator')
));

-- Group expense contributions
CREATE POLICY "Participants can view contributions" ON public.group_expense_contributions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM group_expenses ge
  WHERE ge.id = group_expense_contributions.expense_id
  AND is_conversation_participant(ge.conversation_id, auth.uid())
));
CREATE POLICY "Users can update own contributions" ON public.group_expense_contributions FOR UPDATE
USING (auth.uid() = user_id);

-- Itineraries
CREATE POLICY "Participants can view itineraries" ON public.group_itineraries FOR SELECT
USING (is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Owner/mods can manage itineraries" ON public.group_itineraries FOR ALL
USING (EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = group_itineraries.conversation_id
  AND cp.user_id = auth.uid()
  AND cp.role IN ('owner', 'moderator')
));

-- Itinerary items
CREATE POLICY "Participants can view itinerary items" ON public.itinerary_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM group_itineraries gi
  WHERE gi.id = itinerary_items.itinerary_id
  AND is_conversation_participant(gi.conversation_id, auth.uid())
));
CREATE POLICY "Owner/mods can manage items" ON public.itinerary_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM group_itineraries gi
  JOIN conversation_participants cp ON cp.conversation_id = gi.conversation_id
  WHERE gi.id = itinerary_items.itinerary_id
  AND cp.user_id = auth.uid()
  AND cp.role IN ('owner', 'moderator')
));

-- Partners
CREATE POLICY "Anyone can view active partners" ON public.partners FOR SELECT USING (is_active = true);
CREATE POLICY "Owners can manage own partner profiles" ON public.partners FOR ALL USING (auth.uid() = owner_user_id);
CREATE POLICY "Admins can manage all partners" ON public.partners FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Creator roles
CREATE POLICY "Anyone can view creator roles" ON public.creator_roles FOR SELECT USING (true);
CREATE POLICY "Users can manage own roles" ON public.creator_roles FOR ALL USING (auth.uid() = user_id);

-- Portfolio items
CREATE POLICY "Anyone can view portfolio items" ON public.portfolio_items FOR SELECT USING (true);
CREATE POLICY "Users can manage own portfolio" ON public.portfolio_items FOR ALL USING (auth.uid() = user_id);

-- Menu items
CREATE POLICY "Anyone can view menu items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Users can manage own menu" ON public.menu_items FOR ALL USING (auth.uid() = user_id);

-- DJ mixes
CREATE POLICY "Anyone can view mixes" ON public.dj_mixes FOR SELECT USING (true);
CREATE POLICY "Users can manage own mixes" ON public.dj_mixes FOR ALL USING (auth.uid() = user_id);

-- Dance videos
CREATE POLICY "Anyone can view dance videos" ON public.dance_videos FOR SELECT USING (true);
CREATE POLICY "Users can manage own videos" ON public.dance_videos FOR ALL USING (auth.uid() = user_id);

-- User reviews
CREATE POLICY "Anyone can view reviews" ON public.user_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON public.user_reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can update own reviews" ON public.user_reviews FOR UPDATE USING (auth.uid() = reviewer_id);
CREATE POLICY "Users can delete own reviews" ON public.user_reviews FOR DELETE USING (auth.uid() = reviewer_id);

-- Community updates
CREATE POLICY "Anyone can view published updates" ON public.community_updates FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage updates" ON public.community_updates FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Admin actions (only admins can see)
CREATE POLICY "Admins can view actions" ON public.admin_actions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create actions" ON public.admin_actions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_group_expenses_conversation ON public.group_expenses(conversation_id);
CREATE INDEX idx_expense_contributions_expense ON public.group_expense_contributions(expense_id);
CREATE INDEX idx_itinerary_items_itinerary ON public.itinerary_items(itinerary_id);
CREATE INDEX idx_partners_category ON public.partners(category);
CREATE INDEX idx_partners_city ON public.partners(city);
CREATE INDEX idx_creator_roles_user ON public.creator_roles(user_id);
CREATE INDEX idx_portfolio_items_user ON public.portfolio_items(user_id);
CREATE INDEX idx_menu_items_user ON public.menu_items(user_id);
CREATE INDEX idx_dj_mixes_user ON public.dj_mixes(user_id);
CREATE INDEX idx_dance_videos_user ON public.dance_videos(user_id);
CREATE INDEX idx_user_reviews_reviewed ON public.user_reviews(reviewed_user_id);
CREATE INDEX idx_user_reviews_reviewer ON public.user_reviews(reviewer_id);
CREATE INDEX idx_community_updates_category ON public.community_updates(category);
CREATE INDEX idx_admin_actions_target ON public.admin_actions(target_user_id);

-- Function to calculate user reputation from reviews
CREATE OR REPLACE FUNCTION public.update_reputation_from_review()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.calculate_reputation_score(NEW.reviewed_user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_reputation_from_review();
