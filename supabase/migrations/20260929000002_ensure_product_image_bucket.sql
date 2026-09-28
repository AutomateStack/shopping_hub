-- Ensure the product image storage bucket exists in the live Supabase project.
-- This is intentionally idempotent so it is safe if the bucket already exists.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Recreate the upload policy with the exact bucket/path/admin checks used by
-- the Admin product editor.
DROP POLICY IF EXISTS "ShopHub product images: admin insert" ON storage.objects;
CREATE POLICY "ShopHub product images: admin insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN ('products', 'blog')
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Public catalog images must remain readable by shoppers.
DROP POLICY IF EXISTS "ShopHub product images: public read" ON storage.objects;
CREATE POLICY "ShopHub product images: public read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- Keep admin update/delete access aligned with the upload policy.
DROP POLICY IF EXISTS "ShopHub product images: admin update" ON storage.objects;
CREATE POLICY "ShopHub product images: admin update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN ('products', 'blog')
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "ShopHub product images: admin delete" ON storage.objects;
CREATE POLICY "ShopHub product images: admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
