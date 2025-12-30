-- Add avatar_url and linked_user_id columns to pipeline_items
ALTER TABLE public.pipeline_items 
ADD COLUMN avatar_url text NULL,
ADD COLUMN linked_user_id uuid NULL;

-- Add index for linked_user_id lookups
CREATE INDEX idx_pipeline_items_linked_user_id ON public.pipeline_items(linked_user_id);

-- Add comment for documentation
COMMENT ON COLUMN public.pipeline_items.avatar_url IS 'Custom avatar URL for the contact';
COMMENT ON COLUMN public.pipeline_items.linked_user_id IS 'Optional link to an Ether platform user';