-- Central order fields used by the WhatsApp fulfillment integration.
-- This migration is intentionally additive and can run on a fresh ShoppingHub database.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS external_order_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_uidx
  ON public.orders (external_order_id)
  WHERE external_order_id IS NOT NULL;

COMMENT ON COLUMN public.orders.order_source IS 'Origin of order: website or whatsapp';
COMMENT ON COLUMN public.orders.external_order_id IS 'External order reference, e.g. SH-MUKR8K5-876';
COMMENT ON COLUMN public.orders.tracking_url IS 'Optional carrier tracking URL';
COMMENT ON COLUMN public.orders.whatsapp_phone IS 'WhatsApp phone number associated with the order';
