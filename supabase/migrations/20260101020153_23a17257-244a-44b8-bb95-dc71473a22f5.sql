-- Drop the existing type check constraint and add connector type
ALTER TABLE public.board_items DROP CONSTRAINT IF EXISTS board_items_type_check;

-- Add new constraint that includes 'connector' type
ALTER TABLE public.board_items ADD CONSTRAINT board_items_type_check 
  CHECK (type IN ('note', 'link', 'todo', 'image', 'line', 'column', 'board_ref', 'connector', 'sketch'));