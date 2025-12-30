-- Create contact_tasks table for per-contact to-dos
CREATE TABLE public.contact_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_item_id uuid NOT NULL REFERENCES public.pipeline_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz NULL,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies: owner-only access
CREATE POLICY "Users can view own tasks"
  ON public.contact_tasks FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create own tasks"
  ON public.contact_tasks FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own tasks"
  ON public.contact_tasks FOR UPDATE
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own tasks"
  ON public.contact_tasks FOR DELETE
  USING (auth.uid() = owner_user_id);

-- Create index for performance
CREATE INDEX idx_contact_tasks_owner ON public.contact_tasks(owner_user_id);
CREATE INDEX idx_contact_tasks_pipeline_item ON public.contact_tasks(pipeline_item_id);
CREATE INDEX idx_contact_tasks_due_at ON public.contact_tasks(due_at) WHERE due_at IS NOT NULL;