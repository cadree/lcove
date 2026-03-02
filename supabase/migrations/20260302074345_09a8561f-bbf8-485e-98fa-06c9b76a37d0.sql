
-- Add unique partial index to enforce one groupchat per project
CREATE UNIQUE INDEX IF NOT EXISTS conversations_project_id_unique 
ON public.conversations (project_id) 
WHERE project_id IS NOT NULL;

-- Enable realtime for conversation_participants so team list updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
