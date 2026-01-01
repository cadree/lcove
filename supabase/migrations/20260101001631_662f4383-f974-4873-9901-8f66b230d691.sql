-- Add connector columns to board_items table
ALTER TABLE public.board_items 
ADD COLUMN IF NOT EXISTS start_item_id uuid REFERENCES public.board_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS end_item_id uuid REFERENCES public.board_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS start_anchor text DEFAULT 'right',
ADD COLUMN IF NOT EXISTS end_anchor text DEFAULT 'left',
ADD COLUMN IF NOT EXISTS stroke_width integer NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS stroke_style text NOT NULL DEFAULT 'solid',
ADD COLUMN IF NOT EXISTS stroke_color text NOT NULL DEFAULT '#ffffff';

-- Add check constraints for anchor values
ALTER TABLE public.board_items 
ADD CONSTRAINT board_items_start_anchor_check CHECK (start_anchor IS NULL OR start_anchor IN ('left', 'right', 'top', 'bottom')),
ADD CONSTRAINT board_items_end_anchor_check CHECK (end_anchor IS NULL OR end_anchor IN ('left', 'right', 'top', 'bottom')),
ADD CONSTRAINT board_items_stroke_style_check CHECK (stroke_style IN ('solid', 'dashed'));

-- Add indexes for connector lookups
CREATE INDEX IF NOT EXISTS idx_board_items_start_item ON public.board_items(board_id, start_item_id);
CREATE INDEX IF NOT EXISTS idx_board_items_end_item ON public.board_items(board_id, end_item_id);

-- Comment for clarity
COMMENT ON COLUMN public.board_items.start_item_id IS 'For connector items: the source item this connector attaches to';
COMMENT ON COLUMN public.board_items.end_item_id IS 'For connector items: the target item this connector attaches to';
COMMENT ON COLUMN public.board_items.start_anchor IS 'Anchor point on start item: left, right, top, bottom';
COMMENT ON COLUMN public.board_items.end_anchor IS 'Anchor point on end item: left, right, top, bottom';
COMMENT ON COLUMN public.board_items.stroke_width IS 'Line width in pixels';
COMMENT ON COLUMN public.board_items.stroke_style IS 'Line style: solid or dashed';
COMMENT ON COLUMN public.board_items.stroke_color IS 'Line color as hex string';