-- Drop and recreate the SELECT policy on conversations to include creators
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;

CREATE POLICY "Users can view conversations they participate in or created" 
ON public.conversations 
FOR SELECT 
USING (
  is_conversation_participant(id, auth.uid()) 
  OR created_by = auth.uid()
);