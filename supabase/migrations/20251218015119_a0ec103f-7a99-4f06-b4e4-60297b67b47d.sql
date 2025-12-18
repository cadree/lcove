-- Create stores table for user storefronts
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  accepts_credits BOOLEAN DEFAULT true,
  accepts_cash BOOLEAN DEFAULT true,
  shopify_store_url TEXT,
  shopify_access_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create store categories enum-like reference
CREATE TABLE public.store_item_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('product', 'service', 'rental')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default categories
INSERT INTO public.store_item_categories (name, type) VALUES
  ('Equipment', 'product'),
  ('Clothing', 'product'),
  ('Art & Prints', 'product'),
  ('Music & Audio', 'product'),
  ('Other Products', 'product'),
  ('Photography', 'service'),
  ('Videography', 'service'),
  ('Music Production', 'service'),
  ('Design', 'service'),
  ('Consulting', 'service'),
  ('Other Services', 'service'),
  ('Recording Studio', 'rental'),
  ('Photo Studio', 'rental'),
  ('Event Space', 'rental'),
  ('Equipment Rental', 'rental'),
  ('Other Rentals', 'rental');

-- Create store items table (products, services, rentals)
CREATE TABLE public.store_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.store_item_categories(id),
  type TEXT NOT NULL CHECK (type IN ('product', 'service', 'rental')),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  credits_price INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  inventory_count INTEGER,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  -- Service specific
  duration_minutes INTEGER,
  -- Rental specific
  location TEXT,
  amenities TEXT[],
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create store orders table
CREATE TABLE public.store_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  buyer_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.store_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  total_price NUMERIC NOT NULL,
  credits_spent INTEGER DEFAULT 0,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'credits', 'hybrid')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'refunded')),
  stripe_payment_intent_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rental inquiries table
CREATE TABLE public.rental_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.store_items(id) ON DELETE CASCADE,
  inquirer_id UUID NOT NULL,
  message TEXT NOT NULL,
  preferred_dates TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'booked', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_inquiries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stores
CREATE POLICY "Anyone can view active stores" ON public.stores
  FOR SELECT USING (is_active = true OR user_id = auth.uid());

CREATE POLICY "Users can create own store" ON public.stores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own store" ON public.stores
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own store" ON public.stores
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for categories
CREATE POLICY "Anyone can view categories" ON public.store_item_categories
  FOR SELECT USING (true);

-- RLS Policies for store items
CREATE POLICY "Anyone can view active items" ON public.store_items
  FOR SELECT USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.stores WHERE stores.id = store_items.store_id AND stores.user_id = auth.uid()
  ));

CREATE POLICY "Store owners can create items" ON public.store_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores WHERE stores.id = store_items.store_id AND stores.user_id = auth.uid()
  ));

CREATE POLICY "Store owners can update items" ON public.store_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.stores WHERE stores.id = store_items.store_id AND stores.user_id = auth.uid()
  ));

CREATE POLICY "Store owners can delete items" ON public.store_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.stores WHERE stores.id = store_items.store_id AND stores.user_id = auth.uid()
  ));

-- RLS Policies for orders
CREATE POLICY "Buyers can view own orders" ON public.store_orders
  FOR SELECT USING (buyer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.stores WHERE stores.id = store_orders.store_id AND stores.user_id = auth.uid()
  ));

CREATE POLICY "Users can create orders" ON public.store_orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Store owners can update orders" ON public.store_orders
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.stores WHERE stores.id = store_orders.store_id AND stores.user_id = auth.uid()
  ));

-- RLS Policies for rental inquiries
CREATE POLICY "Inquirers can view own inquiries" ON public.rental_inquiries
  FOR SELECT USING (inquirer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.store_items si
    JOIN public.stores s ON s.id = si.store_id
    WHERE si.id = rental_inquiries.item_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can create inquiries" ON public.rental_inquiries
  FOR INSERT WITH CHECK (auth.uid() = inquirer_id);

CREATE POLICY "Store owners can update inquiries" ON public.rental_inquiries
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.store_items si
    JOIN public.stores s ON s.id = si.store_id
    WHERE si.id = rental_inquiries.item_id AND s.user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX idx_store_items_store_id ON public.store_items(store_id);
CREATE INDEX idx_store_items_type ON public.store_items(type);
CREATE INDEX idx_store_orders_store_id ON public.store_orders(store_id);
CREATE INDEX idx_store_orders_buyer_id ON public.store_orders(buyer_id);
CREATE INDEX idx_rental_inquiries_item_id ON public.rental_inquiries(item_id);

-- Add triggers for updated_at
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_items_updated_at BEFORE UPDATE ON public.store_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_orders_updated_at BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rental_inquiries_updated_at BEFORE UPDATE ON public.rental_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();