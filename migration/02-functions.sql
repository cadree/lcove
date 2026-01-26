-- ============================================
-- ETHER Migration: Database Functions
-- Target: waafzlorvnozeujjhvxu
-- Generated: 2026-01-26
-- ============================================

-- Helper function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

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

-- Check if user is a team admin
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

-- Check if user is a board member
CREATE OR REPLACE FUNCTION public.is_board_member(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = p_user_id
  )
$$;

-- Check if user is a conversation participant
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = uid
  )
$$;

-- Check if users have blocked each other
CREATE OR REPLACE FUNCTION public.is_user_blocked(uid1 uuid, uid2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = uid1 AND blocked_id = uid2)
       OR (blocker_id = uid2 AND blocked_id = uid1)
  )
$$;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Touch updated_at (alias)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Handle new user - create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Create notification preferences for new user
CREATE OR REPLACE FUNCTION public.create_notification_preferences_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id, email_enabled, push_enabled)
  VALUES (NEW.id, true, true)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Update conversation timestamp when message is sent
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Handle project application accepted
CREATE OR REPLACE FUNCTION public.handle_application_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE public.project_roles 
    SET slots_filled = slots_filled + 1,
        is_locked = CASE WHEN slots_filled + 1 >= slots_available THEN true ELSE is_locked END
    WHERE id = NEW.role_id;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Validate profile completion
CREATE OR REPLACE FUNCTION public.validate_profile_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.onboarding_completed = true AND (NEW.display_name IS NULL OR TRIM(NEW.display_name) = '') THEN
    RAISE EXCEPTION 'Cannot complete onboarding without a display name';
  END IF;
  
  IF NEW.access_status = 'active' AND (NEW.display_name IS NULL OR TRIM(NEW.display_name) = '') THEN
    RAISE EXCEPTION 'Cannot activate account without a display name';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Grant genesis credits when profile is approved
CREATE OR REPLACE FUNCTION public.grant_genesis_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO user_credits (user_id, genesis_balance, earned_balance, balance, genesis_lifetime_minted, lifetime_earned, lifetime_spent)
  VALUES (NEW.user_id, 100, 0, 100, 100, 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    genesis_balance = user_credits.genesis_balance + 100,
    balance = user_credits.balance + 100,
    genesis_lifetime_minted = user_credits.genesis_lifetime_minted + 100;
  
  INSERT INTO credit_ledger (user_id, amount, balance_after, type, description, credit_type, genesis_amount, earned_amount)
  VALUES (NEW.user_id, 100, 100, 'earn', 'Genesis Credit - Welcome to ETHER', 'genesis', 100, 0);
  
  INSERT INTO credit_earning_limits (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Update user credits when ledger entry is created (dual currency)
CREATE OR REPLACE FUNCTION public.update_user_credits_dual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance, genesis_balance, earned_balance, lifetime_earned, lifetime_spent)
  VALUES (NEW.user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.credit_type = 'genesis' THEN
    IF NEW.type = 'spend' OR NEW.type = 'transfer_out' THEN
      UPDATE user_credits SET
        genesis_balance = genesis_balance + NEW.genesis_amount,
        genesis_burned = genesis_burned + ABS(NEW.genesis_amount),
        balance = balance + NEW.amount,
        lifetime_spent = lifetime_spent + ABS(NEW.amount),
        updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSE
      UPDATE user_credits SET
        genesis_balance = genesis_balance + NEW.genesis_amount,
        balance = balance + NEW.amount,
        updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
  ELSE
    UPDATE user_credits SET
      earned_balance = earned_balance + COALESCE(NEW.earned_amount, NEW.amount),
      balance = balance + NEW.amount,
      lifetime_earned = CASE WHEN NEW.amount > 0 THEN lifetime_earned + NEW.amount ELSE lifetime_earned END,
      lifetime_spent = CASE WHEN NEW.amount < 0 THEN lifetime_spent + ABS(NEW.amount) ELSE lifetime_spent END,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Legacy update user credits
CREATE OR REPLACE FUNCTION public.update_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
  VALUES (
    NEW.user_id,
    CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance = user_credits.balance + NEW.amount,
    lifetime_earned = CASE WHEN NEW.amount > 0 THEN user_credits.lifetime_earned + NEW.amount ELSE user_credits.lifetime_earned END,
    lifetime_spent = CASE WHEN NEW.amount < 0 THEN user_credits.lifetime_spent + ABS(NEW.amount) ELSE user_credits.lifetime_spent END,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Validate credit balances
CREATE OR REPLACE FUNCTION public.validate_credit_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.genesis_balance < 0 THEN
    RAISE EXCEPTION 'Genesis balance cannot be negative';
  END IF;
  IF NEW.earned_balance < 0 THEN
    RAISE EXCEPTION 'Earned balance cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

-- Calculate reputation score
CREATE OR REPLACE FUNCTION public.calculate_reputation_score(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_review_avg NUMERIC := 0;
  v_review_count INTEGER := 0;
  v_completed_projects INTEGER := 0;
  v_total_score NUMERIC := 0;
BEGIN
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_review_avg, v_review_count
  FROM studio_reviews sr
  JOIN store_items si ON sr.item_id = si.id
  JOIN stores s ON si.store_id = s.id
  WHERE s.user_id = p_user_id;

  SELECT COUNT(DISTINCT pa.project_id)
  INTO v_completed_projects
  FROM project_applications pa
  JOIN projects p ON pa.project_id = p.id
  WHERE pa.applicant_id = p_user_id
    AND pa.status = 'accepted'
    AND p.status = 'completed';

  v_total_score := (v_review_avg * 0.6) + (LEAST(v_completed_projects, 10) * 0.5 * 0.4);

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

-- Update reputation from review
CREATE OR REPLACE FUNCTION public.update_reputation_from_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.calculate_reputation_score(NEW.reviewed_user_id);
  RETURN NEW;
END;
$$;

-- Get platform stats
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE(total_creators bigint, total_projects bigint, total_events bigint, total_cities bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE display_name IS NOT NULL)::BIGINT as total_creators,
    (SELECT COUNT(*) FROM projects WHERE status IN ('open', 'in_progress', 'completed'))::BIGINT as total_projects,
    (SELECT COUNT(*) FROM events WHERE is_public = true)::BIGINT as total_events,
    (SELECT COUNT(DISTINCT LOWER(TRIM(city))) FROM profiles WHERE city IS NOT NULL AND city != '')::BIGINT as total_cities;
END;
$$;

-- Get admin user data (secure function)
CREATE OR REPLACE FUNCTION public.get_admin_user_data()
RETURNS TABLE(user_id uuid, email text, display_name text, phone text, city text, mindset_level integer, access_status text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.user_id,
    au.email::text,
    p.display_name,
    p.phone,
    p.city,
    p.mindset_level,
    p.access_status,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id;
END;
$$;

-- Get user emails for admin
CREATE OR REPLACE FUNCTION public.get_user_emails_for_admin()
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT au.id as user_id, au.email::text
  FROM auth.users au;
END;
$$;

-- Ensure default pipeline exists
CREATE OR REPLACE FUNCTION public.ensure_default_pipeline(p_user_id uuid, p_pipeline_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pipeline_id UUID;
  stage_colors TEXT[] := ARRAY['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];
  stage_names TEXT[] := ARRAY['New', 'Contacted', 'In Progress', 'Closed'];
BEGIN
  IF p_pipeline_id IS NULL THEN
    SELECT id INTO v_pipeline_id
    FROM pipelines
    WHERE owner_user_id = p_user_id
    ORDER BY sort_order, created_at
    LIMIT 1;
    
    IF v_pipeline_id IS NULL THEN
      INSERT INTO pipelines (owner_user_id, name, sort_order)
      VALUES (p_user_id, 'My Pipeline', 0)
      RETURNING id INTO v_pipeline_id;
    END IF;
  ELSE
    v_pipeline_id := p_pipeline_id;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pipeline_stages 
    WHERE owner_user_id = p_user_id AND pipeline_id = v_pipeline_id
  ) THEN
    FOR i IN 1..4 LOOP
      INSERT INTO pipeline_stages (owner_user_id, pipeline_id, name, sort_order, color)
      VALUES (p_user_id, v_pipeline_id, stage_names[i], i - 1, stage_colors[i]);
    END LOOP;
  END IF;
  
  RETURN v_pipeline_id;
END;
$$;
