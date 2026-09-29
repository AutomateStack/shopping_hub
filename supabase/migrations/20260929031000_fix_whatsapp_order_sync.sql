-- Make the bidirectional WhatsApp order sync resilient for both new and
-- previously-created ShoppingHub WhatsApp orders.

-- Ensure the product-level WhatsApp identifiers exist before sync functions use them.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS whatsapp_catalog_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_product_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_retailer_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS whatsapp_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_last_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS products_whatsapp_retailer_id_unique
  ON public.products (whatsapp_retailer_id)
  WHERE whatsapp_retailer_id IS NOT NULL AND btrim(whatsapp_retailer_id) <> '';

-- Backfill the product-level WhatsApp ID from the existing marketplace map.
UPDATE public.products p
SET whatsapp_retailer_id = m.whatsapp_retailer_id,
    updated_at = NOW()
FROM public.shoppinghub_marketplace_map m
WHERE m.product_id IS NOT NULL
  AND m.product_id::text = p.id::text
  AND NULLIF(btrim(p.whatsapp_retailer_id), '') IS NULL
  AND NULLIF(btrim(m.whatsapp_retailer_id), '') IS NOT NULL;

-- Fix website order items that were created before the bot resolved the
-- human product name and therefore stored the WhatsApp retailer ID.
UPDATE public.order_items oi
SET product_id = p.id,
    product_name = COALESCE(NULLIF(btrim(m.product_name), ''), p.name, oi.product_name),
    product_price = COALESCE(NULLIF(oi.product_price, 0), p.price),
    subtotal = COALESCE(NULLIF(oi.product_price, 0), p.price) * oi.quantity
FROM public.orders o
LEFT JOIN public.shoppinghub_order_items soi
  ON soi.order_id = o.external_order_id
 AND (soi.name = oi.product_name OR soi.retailer_id = oi.product_name)
LEFT JOIN public.shoppinghub_marketplace_map m
  ON m.whatsapp_retailer_id = soi.retailer_id
LEFT JOIN public.products p
  ON p.id::text = COALESCE(m.product_id::text, NULLIF(soi.retailer_id, ''))
  OR p.whatsapp_retailer_id = soi.retailer_id
WHERE oi.order_id = o.id
  AND o.order_source = 'whatsapp'
  AND soi.id IS NOT NULL
  AND p.id IS NOT NULL
  AND (
    oi.product_name = soi.retailer_id
    OR oi.product_name IS NULL
    OR btrim(oi.product_name) = ''
  );

-- Keep the website order-item row synchronized when the bot inserts or fixes
-- an item. Prefer the stable WhatsApp retailer ID, then the marketplace map.
CREATE OR REPLACE FUNCTION public.sync_shoppinghub_whatsapp_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  website_order_id UUID;
  product_uuid UUID;
  resolved_name TEXT;
  existing_item_id UUID;
BEGIN
  SELECT id INTO website_order_id
  FROM public.orders
  WHERE external_order_id = NEW.order_id
  LIMIT 1;

  IF website_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.id, COALESCE(NULLIF(btrim(m.product_name), ''), p.name, NEW.name, NEW.retailer_id)
  INTO product_uuid, resolved_name
  FROM public.products p
  LEFT JOIN public.shoppinghub_marketplace_map m
    ON m.whatsapp_retailer_id = NEW.retailer_id
  WHERE p.whatsapp_retailer_id = NEW.retailer_id
     OR (m.product_id IS NOT NULL AND m.product_id::text = p.id::text)
  ORDER BY CASE WHEN p.whatsapp_retailer_id = NEW.retailer_id THEN 0 ELSE 1 END
  LIMIT 1;

  resolved_name := COALESCE(NULLIF(btrim(resolved_name), ''), NEW.name, NEW.retailer_id);

  SELECT oi.id INTO existing_item_id
  FROM public.order_items oi
  WHERE oi.order_id = website_order_id
    AND (
      (product_uuid IS NOT NULL AND oi.product_id = product_uuid)
      OR oi.product_name = NEW.retailer_id
      OR oi.product_name = NEW.name
    )
  ORDER BY oi.id
  LIMIT 1;

  IF existing_item_id IS NOT NULL THEN
    UPDATE public.order_items
    SET product_id = COALESCE(product_uuid, product_id),
        product_name = resolved_name,
        product_price = COALESCE(NEW.item_price, product_price, 0),
        quantity = COALESCE(NEW.quantity, 1),
        subtotal = COALESCE(NEW.item_price, product_price, 0) * COALESCE(NEW.quantity, 1)
    WHERE id = existing_item_id;
  ELSE
    INSERT INTO public.order_items(order_id, product_id, product_name, product_price, quantity, subtotal)
    VALUES (
      website_order_id,
      product_uuid,
      resolved_name,
      COALESCE(NEW.item_price, 0),
      COALESCE(NEW.quantity, 1),
      COALESCE(NEW.item_price, 0) * COALESCE(NEW.quantity, 1)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shoppinghub_whatsapp_order_item ON public.shoppinghub_order_items;
CREATE TRIGGER trg_sync_shoppinghub_whatsapp_order_item
AFTER INSERT OR UPDATE ON public.shoppinghub_order_items
FOR EACH ROW EXECUTE FUNCTION public.sync_shoppinghub_whatsapp_order_item();

-- When the website admin changes a WhatsApp-origin order status, reflect it
-- back to the bot's order table. Keep the website enum names (cancelled) and
-- bot text values aligned.
CREATE OR REPLACE FUNCTION public.sync_website_whatsapp_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_source = 'whatsapp' AND NEW.external_order_id IS NOT NULL THEN
    UPDATE public.shoppinghub_orders
    SET order_status = CASE NEW.status::text
      WHEN 'pending' THEN 'pending'
      WHEN 'processing' THEN 'processing'
      WHEN 'shipped' THEN 'shipped'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE order_status
    END,
    payment_status = COALESCE(NEW.payment_status, payment_status),
    payment_transaction_id = COALESCE(NEW.payment_id, payment_transaction_id),
    updated_at = NOW()
    WHERE order_id = NEW.external_order_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_website_whatsapp_order_status ON public.orders;
CREATE TRIGGER trg_sync_website_whatsapp_order_status
AFTER UPDATE OF status, payment_status, payment_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_website_whatsapp_order_status();
