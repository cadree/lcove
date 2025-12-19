-- Add admin policies for profiles (passions and onboarding fields)
-- First drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add admin policies for questionnaire_responses
DROP POLICY IF EXISTS "Admins can view all questionnaire responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "Admins can update all questionnaire responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "Admins can delete questionnaire responses" ON public.questionnaire_responses;

-- Admins can view all questionnaire responses
CREATE POLICY "Admins can view all questionnaire responses"
ON public.questionnaire_responses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all questionnaire responses
CREATE POLICY "Admins can update all questionnaire responses"
ON public.questionnaire_responses
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can delete questionnaire responses
CREATE POLICY "Admins can delete questionnaire responses"
ON public.questionnaire_responses
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));