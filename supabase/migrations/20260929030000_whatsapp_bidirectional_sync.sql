-- Bidirectional WhatsApp <-> ShoppingHub product and order sync metadata.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS whatsapp_catalog_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS whatsapp_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_last_synced_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_products_whatsapp_catalog_id
  ON public.products (whatsapp_catalog_id);

CREATE INDEX IF NOT EXISTS idx_products_whatsapp_sync_status
  ON public.products (whatsapp_sync_status);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS external_order_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_catalog_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_unique
  ON public.orders (external_order_id)
  WHERE external_order_id IS NOT NULL AND btrim(external_order_id) <> '';

CREATE INDEX IF NOT EXISTS idx_orders_order_source
  ON public.orders (order_source);

COMMENT ON COLUMN public.products.whatsapp_retailer_id IS
  'Stable WhatsApp/Meta Catalog retailer ID used to synchronize this product.';

COMMENT ON COLUMN public.products.whatsapp_sync_enabled IS
  'When true, the WhatsApp catalog sync service keeps this product synchronized.';

COMMENT ON COLUMN public.orders.order_source IS
  'Order origin, for example website or whatsapp.';

COMMENT ON COLUMN public.orders.external_order_id IS
  'External order reference such as the ShoppingHub WhatsApp bot order ID.';

COMMENT ON COLUMN public.orders.whatsapp_phone_number IS
  'WhatsApp customer phone number for WhatsApp-originated orders.';
