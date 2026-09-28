-- Centralize WhatsApp-created orders into the ShoppingHub orders model.
-- Run after the existing ShoppingHub migrations have created public.orders,
-- public.order_items and public.order_status.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS external_order_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_uidx
  ON public.orders (external_order_id)
  WHERE external_order_id IS NOT NULL;

-- Backfill orders that were created by the WhatsApp bot in the separate
-- shoppinghub_orders tables. The migration is idempotent.
INSERT INTO public.orders (
  id,
  user_id,
  guest_name,
  guest_email,
  guest_phone,
  shipping_address,
  city,
  state,
  zip_code,
  total_amount,
  shipping_fee,
  tax_amount,
  discount_amount,
  payment_id,
  payment_status,
  status,
  tracking_number,
  tracking_url,
  order_source,
  external_order_id,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  NULL,
  so.customer_name,
  so.customer_email,
  COALESCE(NULLIF(so.customer_phone, ''), so.phone_number),
  COALESCE(so.address, ''),
  COALESCE(so.city, ''),
  COALESCE(so.state, ''),
  COALESCE(so.pincode, ''),
  COALESCE(so.total_amount, 0),
  0,
  0,
  0,
  NULLIF(so.payment_transaction_id, ''),
  COALESCE(so.payment_status, 'pending'),
  CASE so.order_status
    WHEN 'processing' THEN 'processing'::order_status
    WHEN 'shipped' THEN 'shipped'::order_status
    WHEN 'delivered' THEN 'delivered'::order_status
    WHEN 'cancelled' THEN 'cancelled'::order_status
    ELSE 'pending'::order_status
  END,
  NULLIF(so.tracking_number, ''),
  NULLIF(so.tracking_url, ''),
  'whatsapp',
  so.order_id,
  COALESCE(so.created_at, NOW()),
  COALESCE(so.updated_at, NOW())
FROM public.shoppinghub_orders so
WHERE NOT EXISTS (
  SELECT 1 FROM public.orders o WHERE o.external_order_id = so.order_id
);

INSERT INTO public.order_items (
  id,
  order_id,
  product_id,
  product_name,
  product_price,
  quantity,
  subtotal,
  created_at
)
SELECT
  gen_random_uuid(),
  o.id,
  NULL,
  COALESCE(soi.name, soi.retailer_id),
  COALESCE(soi.item_price, 0),
  COALESCE(soi.quantity, 1),
  COALESCE(soi.item_price, 0) * COALESCE(soi.quantity, 1),
  COALESCE(soi.created_at, NOW())
FROM public.shoppinghub_order_items soi
JOIN public.orders o ON o.external_order_id = soi.order_id
WHERE o.order_source = 'whatsapp'
  AND NOT EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = o.id
      AND oi.product_name = COALESCE(soi.name, soi.retailer_id)
      AND oi.quantity = COALESCE(soi.quantity, 1)
  );

-- Make sure PostgREST sees the new columns immediately.
NOTIFY pgrst, 'reload schema';
