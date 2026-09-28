-- WhatsApp catalog -> ShoppingHub -> marketplace destination mapping
CREATE TABLE IF NOT EXISTS public.shoppinghub_marketplace_map (
  whatsapp_retailer_id TEXT PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  amazon_url TEXT,
  meesho_url TEXT,
  whatsapp_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shoppinghub_marketplace_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view marketplace mappings" ON public.shoppinghub_marketplace_map;
DROP POLICY IF EXISTS "Admins can insert marketplace mappings" ON public.shoppinghub_marketplace_map;
DROP POLICY IF EXISTS "Admins can update marketplace mappings" ON public.shoppinghub_marketplace_map;
DROP POLICY IF EXISTS "Admins can delete marketplace mappings" ON public.shoppinghub_marketplace_map;

CREATE POLICY "Admins can view marketplace mappings"
  ON public.shoppinghub_marketplace_map FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert marketplace mappings"
  ON public.shoppinghub_marketplace_map FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update marketplace mappings"
  ON public.shoppinghub_marketplace_map FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete marketplace mappings"
  ON public.shoppinghub_marketplace_map FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS shoppinghub_marketplace_map_product_id_idx
  ON public.shoppinghub_marketplace_map(product_id);

CREATE INDEX IF NOT EXISTS shoppinghub_marketplace_map_enabled_idx
  ON public.shoppinghub_marketplace_map(enabled);

-- Keep updated_at current for admin edits.
CREATE OR REPLACE FUNCTION public.update_shoppinghub_marketplace_map_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shoppinghub_marketplace_map_updated_at
  ON public.shoppinghub_marketplace_map;

CREATE TRIGGER shoppinghub_marketplace_map_updated_at
  BEFORE UPDATE ON public.shoppinghub_marketplace_map
  FOR EACH ROW
  EXECUTE FUNCTION public.update_shoppinghub_marketplace_map_updated_at();

-- Seed the mapping already used by the WhatsApp bot.
-- The ShoppingHub product_id is intentionally left nullable so the mapping
-- works even before the product is linked from the admin screen.
INSERT INTO public.shoppinghub_marketplace_map
  (whatsapp_retailer_id, product_name, amazon_url, meesho_url, enabled)
VALUES
  (
    'w7ivha0s34',
    'Coir Scrubber Pack of 5',
    'https://www.amazon.in/dp/B0HJHNM3CG',
    'https://www.meesho.com/eco-friendly-natural-coir-scrubber-pack-of-5/p/i5h9ge?ms=2&source=Meri+Shop',
    TRUE
  )
ON CONFLICT (whatsapp_retailer_id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  amazon_url = EXCLUDED.amazon_url,
  meesho_url = EXCLUDED.meesho_url,
  enabled = TRUE,
  updated_at = NOW();
