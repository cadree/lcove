-- Create a table for calendar tasks (events/projects added to My Day)
CREATE TABLE public.calendar_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  personal_item_id UUID REFERENCES public.personal_calendar_items(id) ON DELETE CASCADE,
  due_at TIMESTAMP WITH TIME ZONE,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure at least one reference is set
  CONSTRAINT calendar_task_has_reference CHECK (
    event_id IS NOT NULL OR project_id IS NOT NULL OR personal_item_id IS NOT NULL
  )
);

-- Enable Row Level Security
ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own calendar tasks" 
ON public.calendar_tasks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar tasks" 
ON public.calendar_tasks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar tasks" 
ON public.calendar_tasks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar tasks" 
ON public.calendar_tasks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX idx_calendar_tasks_user_id ON public.calendar_tasks(user_id);
CREATE INDEX idx_calendar_tasks_event_id ON public.calendar_tasks(event_id);
CREATE INDEX idx_calendar_tasks_project_id ON public.calendar_tasks(project_id);
CREATE INDEX idx_calendar_tasks_due_at ON public.calendar_tasks(due_at);
CREATE INDEX idx_calendar_tasks_is_done ON public.calendar_tasks(is_done);