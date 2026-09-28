-- ShoppingHub marketplace links manager for WhatsApp catalog mappings.
CREATE TABLE IF NOT EXISTS public.shoppinghub_marketplace_map (
  whatsapp_retailer_id TEXT PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  amazon_url TEXT,
  meesho_url TEXT,
  whatsapp_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shoppinghub_marketplace_product_id
  ON public.shoppinghub_marketplace_map(product_id);

ALTER TABLE public.shoppinghub_marketplace_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage marketplace mappings" ON public.shoppinghub_marketplace_map;
CREATE POLICY "Admins can manage marketplace mappings"
  ON public.shoppinghub_marketplace_map
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.set_shoppinghub_marketplace_map_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shoppinghub_marketplace_map_updated_at
  ON public.shoppinghub_marketplace_map;
CREATE TRIGGER trg_shoppinghub_marketplace_map_updated_at
  BEFORE UPDATE ON public.shoppinghub_marketplace_map
  FOR EACH ROW EXECUTE FUNCTION public.set_shoppinghub_marketplace_map_updated_at();
