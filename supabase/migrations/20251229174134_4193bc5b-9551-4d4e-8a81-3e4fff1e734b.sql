-- Add folder_id column to portfolio_items table
ALTER TABLE public.portfolio_items 
ADD COLUMN folder_id UUID REFERENCES public.portfolio_folders(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_portfolio_items_folder_id ON public.portfolio_items(folder_id);