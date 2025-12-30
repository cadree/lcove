-- =============================================
-- SMART APPOINTMENT BOOKING MODULE
-- =============================================

-- Create teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create team_members table
CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- Create contacts table
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  company text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create contact_timeline table for activity tracking
CREATE TABLE public.contact_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  type text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'canceled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (ends_at > starts_at)
);

-- Create booking_pages table
CREATE TABLE public.booking_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT 'Book a meeting',
  is_active boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'America/New_York',
  meeting_length_minutes integer NOT NULL DEFAULT 30,
  availability jsonb NOT NULL DEFAULT '{
    "weekly": {
      "mon": [{"start": "09:00", "end": "17:00"}],
      "tue": [{"start": "09:00", "end": "17:00"}],
      "wed": [{"start": "09:00", "end": "17:00"}],
      "thu": [{"start": "09:00", "end": "17:00"}],
      "fri": [{"start": "09:00", "end": "17:00"}],
      "sat": [],
      "sun": []
    },
    "buffers": {"before_min": 0, "after_min": 0},
    "advance_days": 14
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create booking_requests table
CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_page_id uuid NOT NULL REFERENCES public.booking_pages(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  requested_start timestamptz NOT NULL,
  requested_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_request_time_range CHECK (requested_end > requested_start)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_teams_owner ON public.teams(owner_user_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_contacts_owner ON public.contacts(owner_user_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contact_timeline_contact ON public.contact_timeline(contact_id, created_at DESC);

CREATE INDEX idx_appointments_owner_starts ON public.appointments(owner_user_id, starts_at);
CREATE INDEX idx_appointments_team_starts ON public.appointments(team_id, starts_at);
CREATE INDEX idx_appointments_contact ON public.appointments(contact_id);
CREATE INDEX idx_appointments_status ON public.appointments(status);

CREATE INDEX idx_booking_pages_owner_active ON public.booking_pages(owner_user_id, is_active);
CREATE INDEX idx_booking_pages_slug ON public.booking_pages(slug);

CREATE INDEX idx_booking_requests_page_created ON public.booking_requests(booking_page_id, created_at DESC);

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_booking_pages_updated_at
  BEFORE UPDATE ON public.booking_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Check if user is a team member
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id
  )
$$;

-- Check if user is team owner or admin
CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id 
      AND user_id = p_user_id 
      AND role IN ('owner', 'admin')
  )
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- TEAMS POLICIES
CREATE POLICY "Team members can view their teams"
  ON public.teams FOR SELECT
  USING (is_team_member(id, auth.uid()) OR owner_user_id = auth.uid());

CREATE POLICY "Users can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Team owners can update their teams"
  ON public.teams FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Team owners can delete their teams"
  ON public.teams FOR DELETE
  USING (owner_user_id = auth.uid());

-- TEAM_MEMBERS POLICIES
CREATE POLICY "Team members can view team membership"
  ON public.team_members FOR SELECT
  USING (is_team_member(team_id, auth.uid()));

CREATE POLICY "Team admins can manage members"
  ON public.team_members FOR INSERT
  WITH CHECK (is_team_admin(team_id, auth.uid()));

CREATE POLICY "Team admins can update members"
  ON public.team_members FOR UPDATE
  USING (is_team_admin(team_id, auth.uid()));

CREATE POLICY "Team admins can remove members"
  ON public.team_members FOR DELETE
  USING (is_team_admin(team_id, auth.uid()) OR user_id = auth.uid());

-- CONTACTS POLICIES
CREATE POLICY "Users can view own contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own contacts"
  ON public.contacts FOR UPDATE
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own contacts"
  ON public.contacts FOR DELETE
  USING (auth.uid() = owner_user_id);

-- CONTACT_TIMELINE POLICIES
CREATE POLICY "Users can view timeline for own contacts"
  ON public.contact_timeline FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.contacts
    WHERE contacts.id = contact_timeline.contact_id
    AND contacts.owner_user_id = auth.uid()
  ));

CREATE POLICY "Users can create timeline for own contacts"
  ON public.contact_timeline FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts
    WHERE contacts.id = contact_timeline.contact_id
    AND contacts.owner_user_id = auth.uid()
  ));

CREATE POLICY "System can create timeline entries"
  ON public.contact_timeline FOR INSERT
  WITH CHECK (true);

-- APPOINTMENTS POLICIES
CREATE POLICY "Users can view own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Team members can view team appointments"
  ON public.appointments FOR SELECT
  USING (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()));

CREATE POLICY "Users can create own appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Team members can create team appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()));

CREATE POLICY "Users can update own appointments"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Team members can update team appointments"
  ON public.appointments FOR UPDATE
  USING (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()));

CREATE POLICY "Users can delete own appointments"
  ON public.appointments FOR DELETE
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Team members can delete team appointments"
  ON public.appointments FOR DELETE
  USING (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()));

-- BOOKING_PAGES POLICIES
CREATE POLICY "Users can view own booking pages"
  ON public.booking_pages FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Public can view active booking pages by slug"
  ON public.booking_pages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can create booking pages"
  ON public.booking_pages FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own booking pages"
  ON public.booking_pages FOR UPDATE
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own booking pages"
  ON public.booking_pages FOR DELETE
  USING (auth.uid() = owner_user_id);

-- BOOKING_REQUESTS POLICIES
CREATE POLICY "Public can create booking requests for active pages"
  ON public.booking_requests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.booking_pages
    WHERE booking_pages.id = booking_requests.booking_page_id
    AND booking_pages.is_active = true
  ));

CREATE POLICY "Page owners can view their booking requests"
  ON public.booking_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.booking_pages
    WHERE booking_pages.id = booking_requests.booking_page_id
    AND booking_pages.owner_user_id = auth.uid()
  ));

CREATE POLICY "Page owners can update booking requests"
  ON public.booking_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.booking_pages
    WHERE booking_pages.id = booking_requests.booking_page_id
    AND booking_pages.owner_user_id = auth.uid()
  ));