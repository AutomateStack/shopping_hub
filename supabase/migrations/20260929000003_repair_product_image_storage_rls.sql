-- Repair production product-image storage RLS.
-- The live project has the product-images bucket, but its admin upload policy
-- is currently rejecting authenticated admin uploads because the expected
-- public.has_role(uuid, public.app_role) helper is missing.

-- Recreate the role-check helper used throughout the application's RLS rules.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR _user_id <> auth.uid()) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;

-- Make sure the bucket exists and remains public for catalog image display.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- Remove older variants so there is one authoritative policy per operation.
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "ShopHub product images: admin insert" ON storage.objects;
DROP POLICY IF EXISTS "ShopHub product images: admin update" ON storage.objects;
DROP POLICY IF EXISTS "ShopHub product images: admin delete" ON storage.objects;
DROP POLICY IF EXISTS "ShopHub product images: public read" ON storage.objects;
DROP POLICY IF EXISTS "ShopHub product images public read" ON storage.objects;
DROP POLICY IF EXISTS "ShopHub product images admin upload" ON storage.objects;

CREATE POLICY "ShopHub product images admin upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'products'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "ShopHub product images admin update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'products'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "ShopHub product images admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "ShopHub product images public read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');
