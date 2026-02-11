CREATE POLICY "Partners can delete own partnership"
ON public.brand_partnerships
FOR DELETE
USING (auth.uid() = owner_user_id);