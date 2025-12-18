-- Creator verification system
CREATE TABLE public.creator_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  verification_type TEXT NOT NULL DEFAULT 'standard', -- standard, premium, partner
  badge_label TEXT, -- e.g., "Verified Creator", "Rising Star"
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  notes TEXT,
  portfolio_urls TEXT[],
  social_links JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reputation scores (calculated from reviews + completed projects)
CREATE TABLE public.reputation_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  overall_score NUMERIC NOT NULL DEFAULT 0,
  review_score NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  completed_projects INTEGER NOT NULL DEFAULT 0,
  on_time_delivery_rate NUMERIC NOT NULL DEFAULT 0,
  response_rate NUMERIC NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project milestones for escrow
CREATE TABLE public.project_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.project_roles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, submitted, approved, paid
  due_date DATE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  paid_at TIMESTAMP WITH TIME ZONE,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Escrow holdings
CREATE TABLE public.escrow_holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  payer_id UUID NOT NULL,
  payee_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'held', -- held, released, refunded, disputed
  stripe_payment_intent_id TEXT,
  released_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Featured creators rotation
CREATE TABLE public.featured_creators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature_type TEXT NOT NULL DEFAULT 'weekly', -- weekly, monthly, spotlight
  title TEXT,
  description TEXT,
  cover_image_url TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Brand partnerships
CREATE TABLE public.brand_partnerships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL,
  brand_logo_url TEXT,
  description TEXT,
  partnership_type TEXT NOT NULL DEFAULT 'sponsor', -- sponsor, collaborator, supporter
  website_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI project matches (stores recommendations)
CREATE TABLE public.ai_project_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.project_roles(id) ON DELETE SET NULL,
  match_score NUMERIC NOT NULL DEFAULT 0,
  match_reasons JSONB DEFAULT '[]',
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_project_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for creator_verifications
CREATE POLICY "Users can view own verification" ON public.creator_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can apply for verification" ON public.creator_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending verification" ON public.creator_verifications
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Public can view approved verifications" ON public.creator_verifications
  FOR SELECT USING (status = 'approved');

-- RLS Policies for reputation_scores
CREATE POLICY "Anyone can view reputation scores" ON public.reputation_scores
  FOR SELECT USING (true);

CREATE POLICY "System can manage reputation scores" ON public.reputation_scores
  FOR ALL USING (true);

-- RLS Policies for project_milestones
CREATE POLICY "Project participants can view milestones" ON public.project_milestones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.creator_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_applications pa WHERE pa.project_id = project_milestones.project_id AND pa.applicant_id = auth.uid() AND pa.status = 'accepted')
  );

CREATE POLICY "Project creators can manage milestones" ON public.project_milestones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.creator_id = auth.uid())
  );

-- RLS Policies for escrow_holdings
CREATE POLICY "Participants can view escrow" ON public.escrow_holdings
  FOR SELECT USING (payer_id = auth.uid() OR payee_id = auth.uid());

CREATE POLICY "System can manage escrow" ON public.escrow_holdings
  FOR ALL USING (true);

-- RLS Policies for featured_creators
CREATE POLICY "Anyone can view active featured creators" ON public.featured_creators
  FOR SELECT USING (is_active = true);

-- RLS Policies for brand_partnerships
CREATE POLICY "Anyone can view active brand partnerships" ON public.brand_partnerships
  FOR SELECT USING (is_active = true);

-- RLS Policies for ai_project_matches
CREATE POLICY "Users can view own matches" ON public.ai_project_matches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can dismiss own matches" ON public.ai_project_matches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create matches" ON public.ai_project_matches
  FOR INSERT WITH CHECK (true);

-- Function to calculate reputation score
CREATE OR REPLACE FUNCTION public.calculate_reputation_score(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_avg NUMERIC := 0;
  v_review_count INTEGER := 0;
  v_completed_projects INTEGER := 0;
  v_total_score NUMERIC := 0;
BEGIN
  -- Get average review score from studio_reviews
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_review_avg, v_review_count
  FROM studio_reviews sr
  JOIN store_items si ON sr.item_id = si.id
  JOIN stores s ON si.store_id = s.id
  WHERE s.user_id = p_user_id;

  -- Count completed project roles (where user was accepted)
  SELECT COUNT(DISTINCT pa.project_id)
  INTO v_completed_projects
  FROM project_applications pa
  JOIN projects p ON pa.project_id = p.id
  WHERE pa.applicant_id = p_user_id
    AND pa.status = 'accepted'
    AND p.status = 'completed';

  -- Calculate overall score (weighted average)
  -- 60% reviews, 40% completed projects (capped at 5)
  v_total_score := (v_review_avg * 0.6) + (LEAST(v_completed_projects, 10) * 0.5 * 0.4);

  -- Update or insert reputation score
  INSERT INTO reputation_scores (user_id, overall_score, review_score, review_count, completed_projects, last_calculated_at)
  VALUES (p_user_id, v_total_score, v_review_avg, v_review_count, v_completed_projects, now())
  ON CONFLICT (user_id) DO UPDATE SET
    overall_score = v_total_score,
    review_score = v_review_avg,
    review_count = v_review_count,
    completed_projects = v_completed_projects,
    last_calculated_at = now(),
    updated_at = now();

  RETURN v_total_score;
END;
$$;

-- Indexes for performance
CREATE INDEX idx_creator_verifications_user ON public.creator_verifications(user_id);
CREATE INDEX idx_creator_verifications_status ON public.creator_verifications(status);
CREATE INDEX idx_reputation_scores_user ON public.reputation_scores(user_id);
CREATE INDEX idx_project_milestones_project ON public.project_milestones(project_id);
CREATE INDEX idx_escrow_holdings_project ON public.escrow_holdings(project_id);
CREATE INDEX idx_featured_creators_active ON public.featured_creators(is_active, start_date);
CREATE INDEX idx_ai_project_matches_user ON public.ai_project_matches(user_id, is_dismissed);

-- Triggers for updated_at
CREATE TRIGGER update_creator_verifications_updated_at
  BEFORE UPDATE ON public.creator_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reputation_scores_updated_at
  BEFORE UPDATE ON public.reputation_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_milestones_updated_at
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_escrow_holdings_updated_at
  BEFORE UPDATE ON public.escrow_holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();