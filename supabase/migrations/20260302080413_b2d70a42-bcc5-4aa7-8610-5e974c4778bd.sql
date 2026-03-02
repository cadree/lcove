
-- Phase 1: Create checklist and suggestion tables for Project Command Center

-- 1. project_checklist_items
CREATE TABLE public.project_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('props', 'equipment', 'other')),
  name text NOT NULL,
  assigned_user_id uuid,
  status text NOT NULL DEFAULT 'unclaimed' CHECK (status IN ('unclaimed', 'claimed', 'completed')),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. project_item_suggestions
CREATE TABLE public.project_item_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  suggested_by uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('props', 'equipment', 'other')),
  name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_item_suggestions ENABLE ROW LEVEL SECURITY;

-- Updated at trigger for checklist items
CREATE TRIGGER update_checklist_items_updated_at
  BEFORE UPDATE ON public.project_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: Checklist items - viewable by project conversation participants
CREATE POLICY "Project participants can view checklist items"
  ON public.project_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.project_id = project_checklist_items.project_id
        AND cp.user_id = auth.uid()
    )
  );

-- RLS: Only project owner can insert checklist items
CREATE POLICY "Project owner can insert checklist items"
  ON public.project_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_checklist_items.project_id
        AND p.creator_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- RLS: Project owner can update any item; assigned user can update their own assignment
CREATE POLICY "Owner or assigned user can update checklist items"
  ON public.project_checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_checklist_items.project_id
        AND p.creator_id = auth.uid()
    )
    OR (
      assigned_user_id = auth.uid()
    )
    OR (
      status = 'unclaimed'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.conversation_participants cp ON cp.conversation_id = c.id
        WHERE c.project_id = project_checklist_items.project_id
          AND cp.user_id = auth.uid()
      )
    )
  );

-- RLS: Only project owner can delete checklist items
CREATE POLICY "Project owner can delete checklist items"
  ON public.project_checklist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_checklist_items.project_id
        AND p.creator_id = auth.uid()
    )
  );

-- RLS: Suggestions - participants can view
CREATE POLICY "Project participants can view suggestions"
  ON public.project_item_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.project_id = project_item_suggestions.project_id
        AND cp.user_id = auth.uid()
    )
  );

-- RLS: Any participant can suggest
CREATE POLICY "Project participants can suggest items"
  ON public.project_item_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    suggested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.project_id = project_item_suggestions.project_id
        AND cp.user_id = auth.uid()
    )
  );

-- RLS: Only owner can update suggestions (approve/deny)
CREATE POLICY "Project owner can review suggestions"
  ON public.project_item_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_item_suggestions.project_id
        AND p.creator_id = auth.uid()
    )
  );

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_item_suggestions;
