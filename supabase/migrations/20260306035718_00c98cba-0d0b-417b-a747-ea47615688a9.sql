-- Ensure the INSERT policy for guest_role_applications explicitly allows anon
-- Drop and recreate to be safe
DROP POLICY IF EXISTS "Anyone can submit guest applications" ON public.guest_role_applications;
CREATE POLICY "Anyone can submit guest applications" ON public.guest_role_applications
FOR INSERT TO anon, authenticated
WITH CHECK (true);