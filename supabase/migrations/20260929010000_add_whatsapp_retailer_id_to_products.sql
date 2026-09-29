-- Store the WhatsApp catalog's product_retailer_id directly on the ShoppingHub product.
-- This gives Marketplace Links a single product-level source of truth.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS whatsapp_retailer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_whatsapp_retailer_id_unique
  ON public.products (whatsapp_retailer_id)
  WHERE whatsapp_retailer_id IS NOT NULL AND btrim(whatsapp_retailer_id) <> '';

COMMENT ON COLUMN public.products.whatsapp_retailer_id IS
  'WhatsApp/Meta catalog product_retailer_id (retailer/content ID). Captured from WhatsApp order/product webhook payloads.';

-- Preserve any IDs that were already learned by the existing marketplace map.
-- Only fill an empty product field; never overwrite a newer product-level value.
DO $$
BEGIN
  IF to_regclass('public.shoppinghub_marketplace_map') IS NOT NULL THEN
    UPDATE public.products p
    SET whatsapp_retailer_id = m.whatsapp_retailer_id,
        updated_at = NOW()
    FROM public.shoppinghub_marketplace_map m
    WHERE m.product_id IS NOT NULL
      AND m.product_id::text = p.id::text
      AND (p.whatsapp_retailer_id IS NULL OR btrim(p.whatsapp_retailer_id) = '')
      AND m.whatsapp_retailer_id IS NOT NULL
      AND btrim(m.whatsapp_retailer_id) <> '';
  END IF;
END $$;
