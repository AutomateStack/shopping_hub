-- Reconcile the production product schema with the Admin product form.
-- This migration is intentionally idempotent because some production environments
-- have the auth/storage pieces applied while the original product migration is missing
-- or PostgREST has a stale schema cache.

-- 1) Ensure the products table exists with the fields used by the current Admin UI.
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  category TEXT,
  stock INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  subcategory_id UUID,
  volume_tiers JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If products already existed but was created from an older migration, add the
-- newer columns without destroying existing data.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory_id UUID,
  ADD COLUMN IF NOT EXISTS volume_tiers JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Replace product policies with policies that work with the production user_roles
-- table (whose role column is text in the affected environment).
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "ShopHub admins can insert products" ON public.products;
DROP POLICY IF EXISTS "ShopHub admins can update products" ON public.products;
DROP POLICY IF EXISTS "ShopHub admins can delete products" ON public.products;

CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "ShopHub admins can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "ShopHub admins can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "ShopHub admins can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- 2) Ensure the gallery table used immediately after product creation exists.
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  alt_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins can insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins can update product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins can delete product images" ON public.product_images;

CREATE POLICY "Anyone can view product images"
  ON public.product_images FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert product images"
  ON public.product_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can update product images"
  ON public.product_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete product images"
  ON public.product_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- 3) Ensure variants table used by the Admin form exists.
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL,
  variant_value TEXT NOT NULL,
  price_adjustment DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can insert product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can update product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can delete product variants" ON public.product_variants;

CREATE POLICY "Anyone can view product variants"
  ON public.product_variants FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert product variants"
  ON public.product_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can update product variants"
  ON public.product_variants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete product variants"
  ON public.product_variants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- 4) Keep updated_at working for products without assuming the trigger exists.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Tell PostgREST to rebuild its schema cache after all DDL above.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
