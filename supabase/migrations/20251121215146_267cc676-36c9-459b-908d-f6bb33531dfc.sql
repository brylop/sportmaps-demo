-- Create products table for e-commerce
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category TEXT NOT NULL,
  image_url TEXT,
  discount INTEGER CHECK (discount >= 0 AND discount <= 100),
  rating NUMERIC CHECK (rating >= 0 AND rating <= 5),
  reviews_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Everyone can view products
CREATE POLICY "Anyone can view products"
  ON public.products
  FOR SELECT
  USING (true);

-- Store owners can create products
CREATE POLICY "Store owners can create products"
  ON public.products
  FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

-- Store owners can update their own products
CREATE POLICY "Store owners can update own products"
  ON public.products
  FOR UPDATE
  USING (auth.uid() = vendor_id);

-- Store owners can delete their own products
CREATE POLICY "Store owners can delete own products"
  ON public.products
  FOR DELETE
  USING (auth.uid() = vendor_id);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  total NUMERIC NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  shipping_address JSONB NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own orders
CREATE POLICY "Users can create own orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at on products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add trigger for updated_at on orders
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();