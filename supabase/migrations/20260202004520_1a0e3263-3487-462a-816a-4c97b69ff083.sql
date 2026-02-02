-- Drop the existing trigger
DROP TRIGGER IF EXISTS on_task_change ON public.contact_tasks;

-- Recreate the function to handle AFTER INSERT but BEFORE UPDATE
CREATE OR REPLACE FUNCTION public.log_task_event()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_name TEXT;
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

-- Create separate triggers: AFTER for INSERT/DELETE, BEFORE for UPDATE (to set completed_at)
CREATE TRIGGER on_task_insert
AFTER INSERT ON public.contact_tasks
FOR EACH ROW
EXECUTE FUNCTION log_task_event();

CREATE TRIGGER on_task_update
BEFORE UPDATE ON public.contact_tasks
FOR EACH ROW
EXECUTE FUNCTION log_task_event();

CREATE TRIGGER on_task_delete
AFTER DELETE ON public.contact_tasks
FOR EACH ROW
EXECUTE FUNCTION log_task_event();