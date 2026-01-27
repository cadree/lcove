-- 1. Add archive/completion tracking to contact_tasks
ALTER TABLE public.contact_tasks 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create task_events table for visualizer
CREATE TABLE IF NOT EXISTS public.task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  task_id UUID REFERENCES public.contact_tasks(id) ON DELETE SET NULL,
  pipeline_item_id UUID REFERENCES public.pipeline_items(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  task_title TEXT NOT NULL,
  contact_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS on task_events
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for task_events
CREATE POLICY "Users can view own task events" 
ON public.task_events FOR SELECT 
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create own task events" 
ON public.task_events FOR INSERT 
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own task events" 
ON public.task_events FOR DELETE 
USING (auth.uid() = owner_user_id);

-- 5. Function to log task events
CREATE OR REPLACE FUNCTION public.log_task_event()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_name TEXT;
  v_event_type TEXT;
BEGIN
  -- Get contact name from pipeline_items
  SELECT name INTO v_contact_name 
  FROM public.pipeline_items 
  WHERE id = COALESCE(NEW.pipeline_item_id, OLD.pipeline_item_id);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_events (owner_user_id, task_id, pipeline_item_id, event_type, task_title, contact_name)
    VALUES (NEW.owner_user_id, NEW.id, NEW.pipeline_item_id, 'created', NEW.title, v_contact_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log completion event
    IF OLD.is_done = false AND NEW.is_done = true THEN
      INSERT INTO public.task_events (owner_user_id, task_id, pipeline_item_id, event_type, task_title, contact_name)
      VALUES (NEW.owner_user_id, NEW.id, NEW.pipeline_item_id, 'completed', NEW.title, v_contact_name);
      -- Set completed_at timestamp
      NEW.completed_at = now();
    END IF;
    -- Log archive event
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
      INSERT INTO public.task_events (owner_user_id, task_id, pipeline_item_id, event_type, task_title, contact_name)
      VALUES (NEW.owner_user_id, NEW.id, NEW.pipeline_item_id, 'archived', NEW.title, v_contact_name);
    END IF;
    -- Log update event (title change)
    IF OLD.title != NEW.title THEN
      INSERT INTO public.task_events (owner_user_id, task_id, pipeline_item_id, event_type, task_title, contact_name)
      VALUES (NEW.owner_user_id, NEW.id, NEW.pipeline_item_id, 'updated', NEW.title, v_contact_name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.task_events (owner_user_id, task_id, pipeline_item_id, event_type, task_title, contact_name)
    VALUES (OLD.owner_user_id, NULL, OLD.pipeline_item_id, 'deleted', OLD.title, v_contact_name);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create trigger for task events logging
DROP TRIGGER IF EXISTS on_task_change ON public.contact_tasks;
CREATE TRIGGER on_task_change
  BEFORE INSERT OR UPDATE OR DELETE ON public.contact_tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_event();

-- 7. Index for performance
CREATE INDEX IF NOT EXISTS idx_task_events_owner ON public.task_events(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_task_events_created ON public.task_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_tasks_archived ON public.contact_tasks(archived_at) WHERE archived_at IS NOT NULL;