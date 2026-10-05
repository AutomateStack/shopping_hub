-- Product-specific ordering configuration for the WhatsApp sales flow.
-- This migration is additive and is based on the current main schema.

ALTER TABLE public.shoppinghub_marketplace_map
  ADD COLUMN IF NOT EXISTS amazon_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS meesho_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS whatsapp_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS wholesale_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wholesale_pricing JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.shoppinghub_order_settings (
  setting_key TEXT PRIMARY KEY,
  numeric_value NUMERIC(12,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.shoppinghub_order_settings (setting_key, numeric_value)
VALUES ('cod_charge', 20.00)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.shoppinghub_orders
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'retail',
  ADD COLUMN IF NOT EXISTS selected_channel TEXT,
  ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cod_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_unit_price NUMERIC(12,2);

ALTER TABLE public.shoppinghub_order_items
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'retail',
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS channel_unit_price NUMERIC(12,2);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_type TEXT,
  ADD COLUMN IF NOT EXISTS fulfillment_channel TEXT,
  ADD COLUMN IF NOT EXISTS channel_unit_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cod_charge NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.shoppinghub_orders
  DROP CONSTRAINT IF EXISTS shoppinghub_orders_customer_type_check;
ALTER TABLE public.shoppinghub_orders
  ADD CONSTRAINT shoppinghub_orders_customer_type_check
  CHECK (customer_type IN ('retail', 'wholesale'));

ALTER TABLE public.shoppinghub_orders
  DROP CONSTRAINT IF EXISTS shoppinghub_orders_selected_channel_check;
ALTER TABLE public.shoppinghub_orders
  ADD CONSTRAINT shoppinghub_orders_selected_channel_check
  CHECK (selected_channel IS NULL OR selected_channel IN ('whatsapp', 'cod', 'marketplace', 'wholesale'));

CREATE INDEX IF NOT EXISTS idx_shoppinghub_marketplace_map_product_id
  ON public.shoppinghub_marketplace_map (product_id);
CREATE INDEX IF NOT EXISTS idx_shoppinghub_orders_selected_channel
  ON public.shoppinghub_orders (selected_channel);
CREATE INDEX IF NOT EXISTS idx_shoppinghub_orders_customer_type
  ON public.shoppinghub_orders (customer_type);
