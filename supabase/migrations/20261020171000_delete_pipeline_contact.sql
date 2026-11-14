-- Deleting a contact cascades into contact_tasks. The task log trigger is
-- SECURITY DEFINER and inserts a task_events row that still points at the
-- contact, so the parent delete fails its foreign key. Skip that log only
-- while the owner delete RPC is running.

CREATE OR REPLACE FUNCTION public.log_task_event()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('ether.skip_task_event', true) = '1' THEN
    RETURN OLD;
  END IF;

  SELECT name INTO v_contact_name
  FROM public.pipeline_items
  WHERE id = COALESCE(NEW.pipeline_item_id, OLD.pipeline_item_id);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_events (owner_user_id, task_id, pipeline_item_id, event_type, task_title, contact_name)
    VALUES (NEW.owner_user_id, NEW.id, NEW.pipeline_item_id, 'created', NEW.title, v_contact_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_done = false AND NEW.is_done = true THEN
      INSERT INTO public.task_events (owner_user_id, task_id, pipeline_item_id, event_type, task_title, contact_name)
      VALUES (NEW.owner_user_id, NEW.id, NEW.pipeline_item_id, 'completed', NEW.title, v_contact_name);
      NEW.completed_at = now();
    END IF;
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
      INSERT INTO public.task_events (owner_user_id, task_id, pipeline_item_id, event_type, task_title, contact_name)
      VALUES (NEW.owner_user_id, NEW.id, NEW.pipeline_item_id, 'archived', NEW.title, v_contact_name);
    END IF;
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

CREATE OR REPLACE FUNCTION public.delete_pipeline_contact(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_items
    WHERE id = p_item_id AND owner_user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  PERFORM set_config('ether.skip_task_event', '1', true);
  DELETE FROM public.pipeline_items
  WHERE id = p_item_id AND owner_user_id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_pipeline_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_pipeline_contact(uuid) TO authenticated;
