-- Product-specific ordering configuration for the WhatsApp sales flow.
-- This migration is intentionally additive and does not alter production/main.

ALTER TABLE public.shoppinghub_marketplace_map
  ADD COLUMN IF NOT EXISTS amazon_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS meesho_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS whatsapp_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS wholesale_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wholesale_pricing JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Global COD charge. Keep this separate from product prices so the same charge
-- can be changed once for the whole ordering system.
CREATE TABLE IF NOT EXISTS public.shoppinghub_order_settings (
  setting_key TEXT PRIMARY KEY,
  numeric_value NUMERIC(12,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.shoppinghub_order_settings (setting_key, numeric_value)
VALUES ('cod_charge', 20.00)
ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON COLUMN public.shoppinghub_marketplace_map.amazon_price IS 'Retail Amazon price for this exact WhatsApp catalog product.';
COMMENT ON COLUMN public.shoppinghub_marketplace_map.meesho_price IS 'Retail Meesho price for this exact WhatsApp catalog product.';
COMMENT ON COLUMN public.shoppinghub_marketplace_map.whatsapp_price IS 'Retail WhatsApp ordering price for this exact product.';
COMMENT ON COLUMN public.shoppinghub_marketplace_map.whatsapp_enabled IS 'Whether direct WhatsApp retail ordering is offered for this product.';
COMMENT ON COLUMN public.shoppinghub_marketplace_map.cod_enabled IS 'Whether COD retail ordering is offered for this product.';
COMMENT ON COLUMN public.shoppinghub_marketplace_map.wholesale_enabled IS 'Whether wholesale ordering is offered for this product.';
COMMENT ON COLUMN public.shoppinghub_marketplace_map.wholesale_pricing IS 'Quantity-tier pricing, e.g. [{"min_quantity":10,"max_quantity":24,"unit_price":180}].';
COMMENT ON TABLE public.shoppinghub_order_settings IS 'Global configuration for ShoppingHub order channels.';

-- Persist the customer's intent and selected channel/price on the existing
-- WhatsApp order tables. Existing WhatsApp orders remain valid because all
-- new fields are nullable/defaulted.
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

-- Keep values constrained to the flow we are implementing.
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

-- Helpful indexes for exact product/channel resolution.
CREATE INDEX IF NOT EXISTS idx_shoppinghub_marketplace_map_product_id
  ON public.shoppinghub_marketplace_map (product_id);
CREATE INDEX IF NOT EXISTS idx_shoppinghub_orders_selected_channel
  ON public.shoppinghub_orders (selected_channel);
CREATE INDEX IF NOT EXISTS idx_shoppinghub_orders_customer_type
  ON public.shoppinghub_orders (customer_type);
