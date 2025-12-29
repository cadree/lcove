-- Create portfolio folders table for organizing content by category
CREATE TABLE public.portfolio_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.portfolio_folders ENABLE ROW LEVEL SECURITY;

-- Create policies for portfolio folders
CREATE POLICY "Portfolio folders are viewable by everyone" 
ON public.portfolio_folders 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own portfolio folders" 
ON public.portfolio_folders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio folders" 
ON public.portfolio_folders 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio folders" 
ON public.portfolio_folders 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add folder_id column to posts table to link posts to folders
ALTER TABLE public.posts 
ADD COLUMN folder_id UUID REFERENCES public.portfolio_folders(id) ON DELETE SET NULL;

-- Create index for faster folder-based queries
CREATE INDEX idx_portfolio_folders_user_id ON public.portfolio_folders(user_id);
CREATE INDEX idx_posts_folder_id ON public.posts(folder_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_portfolio_folders_updated_at
BEFORE UPDATE ON public.portfolio_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();