-- Store the WhatsApp catalog's product_retailer_id directly on the ShoppingHub product.
-- This gives Marketplace Links a single product-level source of truth.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS whatsapp_retailer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_whatsapp_retailer_id_unique
  ON public.products (whatsapp_retailer_id)
  WHERE whatsapp_retailer_id IS NOT NULL AND btrim(whatsapp_retailer_id) <> '';

COMMENT ON COLUMN public.products.whatsapp_retailer_id IS
  'WhatsApp/Meta catalog product_retailer_id (retailer/content ID). Captured from WhatsApp order/product webhook payloads.';

-- Keep the existing marketplace map compatible. When a product is linked,
-- the admin UI can use this product-level value instead of asking for the ID again.
