
-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  price NUMERIC NOT NULL DEFAULT 0,
  package_duration INTEGER NOT NULL DEFAULT 30,
  info TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view products
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Only admin and sub_admin can insert
CREATE POLICY "Admin/SubAdmin can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sub_admin')
  );

-- Only admin and sub_admin can update
CREATE POLICY "Admin/SubAdmin can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sub_admin')
  );

-- Only admin can delete
CREATE POLICY "Admin can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger for products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Allow authenticated users to upload product images
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Allow public read access to product images
CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

-- Create storage bucket for profile avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can update avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');
