
-- challenges
CREATE TABLE public.challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  rules text,
  reward_credits integer NOT NULL DEFAULT 0,
  cost_credits integer NOT NULL DEFAULT 0,
  deadline timestamptz,
  cover_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT false,
  participant_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_creator ON public.challenges(creator_id);
CREATE INDEX idx_challenges_published_active ON public.challenges(is_published, is_active) WHERE is_published = true AND is_active = true;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published challenges are viewable by all"
ON public.challenges FOR SELECT
USING (is_published = true OR creator_id = auth.uid());

CREATE POLICY "Creators can insert their own challenges"
ON public.challenges FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their own challenges"
ON public.challenges FOR UPDATE
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their own challenges"
ON public.challenges FOR DELETE
USING (auth.uid() = creator_id);

CREATE TRIGGER update_challenges_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- participants
CREATE TABLE public.challenge_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_cp_challenge ON public.challenge_participants(challenge_id);
CREATE INDEX idx_cp_user ON public.challenge_participants(user_id);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants viewable by self or challenge creator"
ON public.challenge_participants FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.creator_id = auth.uid())
);

CREATE POLICY "Users can join active published challenges"
ON public.challenge_participants FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id
      AND c.is_published = true
      AND c.is_active = true
      AND (c.deadline IS NULL OR c.deadline > now())
  )
);

CREATE POLICY "Users can leave their own participation"
ON public.challenge_participants FOR DELETE
USING (user_id = auth.uid());

-- bump participant_count
CREATE OR REPLACE FUNCTION public.bump_challenge_participant_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.challenges SET participant_count = participant_count + 1 WHERE id = NEW.challenge_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.challenges SET participant_count = GREATEST(participant_count - 1, 0) WHERE id = OLD.challenge_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bump_challenge_participant_count
AFTER INSERT OR DELETE ON public.challenge_participants
FOR EACH ROW EXECUTE FUNCTION public.bump_challenge_participant_count();

-- submissions
CREATE TABLE public.challenge_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_url text,
  submission_text text,
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_cs_challenge ON public.challenge_submissions(challenge_id);
CREATE INDEX idx_cs_user ON public.challenge_submissions(user_id);

ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submissions viewable by self or challenge creator"
ON public.challenge_submissions FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.creator_id = auth.uid())
);

CREATE POLICY "Joined users can submit"
ON public.challenge_submissions FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.challenge_participants p
    WHERE p.challenge_id = challenge_submissions.challenge_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own submission"
ON public.challenge_submissions FOR UPDATE
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.creator_id = auth.uid()
));

CREATE POLICY "Users can delete their own submission"
ON public.challenge_submissions FOR DELETE
USING (user_id = auth.uid());
