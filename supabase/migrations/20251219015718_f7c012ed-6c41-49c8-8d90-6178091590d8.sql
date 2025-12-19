-- Drop existing policies if they exist (use DO block for conditional drops)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own responses" ON public.questionnaire_responses;
  DROP POLICY IF EXISTS "System can insert responses" ON public.questionnaire_responses;
  DROP POLICY IF EXISTS "Admins can view all responses" ON public.questionnaire_responses;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Recreate policies
CREATE POLICY "Users can view own responses"
ON public.questionnaire_responses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert responses"
ON public.questionnaire_responses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all responses"
ON public.questionnaire_responses
FOR SELECT
USING (has_role(auth.uid(), 'admin'));