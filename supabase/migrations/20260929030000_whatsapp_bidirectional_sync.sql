-- Bidirectional WhatsApp <-> ShoppingHub product and order sync metadata.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS whatsapp_catalog_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS whatsapp_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_last_synced_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_products_whatsapp_catalog_id ON public.products (whatsapp_catalog_id);
CREATE INDEX IF NOT EXISTS idx_products_whatsapp_sync_status ON public.products (whatsapp_sync_status);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS external_order_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_catalog_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_unique ON public.orders (external_order_id)
  WHERE external_order_id IS NOT NULL AND btrim(external_order_id) <> '';
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON public.orders (order_source);

-- Keep the bot's existing PostgreSQL tables in the same Supabase database.
CREATE TABLE IF NOT EXISTS public.shoppinghub_orders (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  catalog_id TEXT,
  total_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'pending',
  payment_transaction_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.shoppinghub_order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.shoppinghub_orders(order_id) ON DELETE CASCADE,
  retailer_id TEXT NOT NULL,
  name TEXT,
  quantity INTEGER DEFAULT 1,
  item_price NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shoppinghub_orders_order_id ON public.shoppinghub_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_shoppinghub_order_items_order_id ON public.shoppinghub_order_items(order_id);

COMMENT ON COLUMN public.products.whatsapp_retailer_id IS 'Stable WhatsApp/Meta Catalog retailer ID used to synchronize this product.';
COMMENT ON COLUMN public.products.whatsapp_sync_enabled IS 'When true, the WhatsApp catalog sync service keeps this product synchronized.';
COMMENT ON COLUMN public.orders.order_source IS 'Order origin, for example website or whatsapp.';
COMMENT ON COLUMN public.orders.external_order_id IS 'External order reference such as the ShoppingHub WhatsApp bot order ID.';
COMMENT ON COLUMN public.orders.whatsapp_phone_number IS 'WhatsApp customer phone number for WhatsApp-originated orders.';

-- WhatsApp order -> website order mirror.
CREATE OR REPLACE FUNCTION public.sync_shoppinghub_whatsapp_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE website_order_id UUID;
BEGIN
  SELECT id INTO website_order_id FROM public.orders WHERE external_order_id = NEW.order_id LIMIT 1;
  IF website_order_id IS NULL THEN
    INSERT INTO public.orders (
      guest_name, guest_email, guest_phone, shipping_address, city, state, zip_code,
      total_amount, status, payment_id, payment_status, order_source,
      external_order_id, whatsapp_phone_number, whatsapp_catalog_id, created_at, updated_at
    ) VALUES (
      NULLIF(NEW.customer_name, ''), NULLIF(NEW.customer_email, ''),
      COALESCE(NULLIF(NEW.customer_phone, ''), NEW.phone_number),
      COALESCE(NULLIF(NEW.address, ''), 'WhatsApp order - address pending'),
      COALESCE(NULLIF(NEW.city, ''), 'Pending'), COALESCE(NULLIF(NEW.state, ''), 'Pending'),
      COALESCE(NULLIF(NEW.pincode, ''), '000000'), COALESCE(NEW.total_amount, 0),
      CASE WHEN NEW.order_status = 'processing' THEN 'processing'::public.order_status ELSE 'pending'::public.order_status END,
      NULLIF(NEW.payment_transaction_id, ''), COALESCE(NULLIF(NEW.payment_status, ''), 'pending'),
      'whatsapp', NEW.order_id, NEW.phone_number, NULLIF(NEW.catalog_id, ''),
      COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW())
    ) RETURNING id INTO website_order_id;
  ELSE
    UPDATE public.orders
    SET guest_name = NULLIF(NEW.customer_name, ''),
        guest_email = NULLIF(NEW.customer_email, ''),
        guest_phone = COALESCE(NULLIF(NEW.customer_phone, ''), NEW.phone_number),
        shipping_address = COALESCE(NULLIF(NEW.address, ''), shipping_address),
        city = COALESCE(NULLIF(NEW.city, ''), city),
        state = COALESCE(NULLIF(NEW.state, ''), state),
        zip_code = COALESCE(NULLIF(NEW.pincode, ''), zip_code),
        total_amount = COALESCE(NEW.total_amount, total_amount),
        status = CASE
          WHEN NEW.order_status = 'processing' THEN 'processing'::public.order_status
          WHEN NEW.order_status = 'shipped' THEN 'shipped'::public.order_status
          WHEN NEW.order_status = 'delivered' THEN 'delivered'::public.order_status
          WHEN NEW.order_status = 'cancelled' THEN 'cancelled'::public.order_status
          ELSE status END,
        payment_id = COALESCE(NULLIF(NEW.payment_transaction_id, ''), payment_id),
        payment_status = COALESCE(NULLIF(NEW.payment_status, ''), payment_status),
        whatsapp_phone_number = NEW.phone_number,
        whatsapp_catalog_id = NULLIF(NEW.catalog_id, ''),
        updated_at = NOW()
    WHERE id = website_order_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_shoppinghub_whatsapp_order ON public.shoppinghub_orders;
CREATE TRIGGER trg_sync_shoppinghub_whatsapp_order AFTER INSERT OR UPDATE ON public.shoppinghub_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_shoppinghub_whatsapp_order();

-- Mirror each WhatsApp cart line into the corresponding website order line.
CREATE OR REPLACE FUNCTION public.sync_shoppinghub_whatsapp_order_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE website_order_id UUID; product_uuid UUID;
BEGIN
  SELECT id INTO website_order_id FROM public.orders WHERE external_order_id = NEW.order_id LIMIT 1;
  IF website_order_id IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO product_uuid FROM public.products
  WHERE whatsapp_retailer_id = NEW.retailer_id
     OR (whatsapp_retailer_id IS NULL AND lower(name) = lower(COALESCE(NEW.name, NEW.retailer_id)))
  ORDER BY CASE WHEN whatsapp_retailer_id = NEW.retailer_id THEN 0 ELSE 1 END LIMIT 1;
  INSERT INTO public.order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
  SELECT website_order_id, product_uuid, COALESCE(NEW.name, NEW.retailer_id),
         COALESCE(NEW.item_price, 0), COALESCE(NEW.quantity, 1),
         COALESCE(NEW.item_price, 0) * COALESCE(NEW.quantity, 1)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id = website_order_id
      AND oi.product_name = COALESCE(NEW.name, NEW.retailer_id)
      AND oi.product_price = COALESCE(NEW.item_price, 0)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_shoppinghub_whatsapp_order_item ON public.shoppinghub_order_items;
CREATE TRIGGER trg_sync_shoppinghub_whatsapp_order_item AFTER INSERT ON public.shoppinghub_order_items
FOR EACH ROW EXECUTE FUNCTION public.sync_shoppinghub_whatsapp_order_item();

-- Website admin status changes -> WhatsApp bot tracking state.
CREATE OR REPLACE FUNCTION public.sync_website_whatsapp_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_source = 'whatsapp' AND NEW.external_order_id IS NOT NULL THEN
    UPDATE public.shoppinghub_orders
    SET order_status = NEW.status::text,
        payment_status = COALESCE(NEW.payment_status, payment_status),
        payment_transaction_id = COALESCE(NEW.payment_id, payment_transaction_id),
        updated_at = NOW()
    WHERE order_id = NEW.external_order_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_website_whatsapp_order_status ON public.orders;
CREATE TRIGGER trg_sync_website_whatsapp_order_status AFTER UPDATE OF status, payment_status, payment_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_website_whatsapp_order_status();
