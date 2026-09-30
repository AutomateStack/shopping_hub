-- WhatsApp catalog -> ShoppingHub product synchronization.
-- WhatsApp remains the catalog source of truth; ShoppingHub mirrors the catalog.

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

CREATE INDEX IF NOT EXISTS idx_products_whatsapp_catalog_id
  ON public.products (whatsapp_catalog_id);

CREATE INDEX IF NOT EXISTS idx_products_whatsapp_sync_status
  ON public.products (whatsapp_sync_status);

CREATE TABLE IF NOT EXISTS public.whatsapp_catalog_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id TEXT,
  catalog_name TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  products_seen INTEGER NOT NULL DEFAULT 0,
  products_created INTEGER NOT NULL DEFAULT 0,
  products_updated INTEGER NOT NULL DEFAULT 0,
  products_unchanged INTEGER NOT NULL DEFAULT 0,
  products_removed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_catalog_sync_runs_started_at
  ON public.whatsapp_catalog_sync_runs (started_at DESC);

ALTER TABLE public.whatsapp_catalog_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view WhatsApp catalog sync runs" ON public.whatsapp_catalog_sync_runs;
CREATE POLICY "Admins can view WhatsApp catalog sync runs"
  ON public.whatsapp_catalog_sync_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

COMMENT ON TABLE public.whatsapp_catalog_sync_runs IS
  'Audit history for WhatsApp Business catalog synchronization into ShoppingHub products.';
COMMENT ON COLUMN public.products.whatsapp_retailer_id IS
  'Stable WhatsApp/Meta catalog retailer ID used as the product synchronization key.';
COMMENT ON COLUMN public.products.whatsapp_sync_status IS
  'WhatsApp catalog mirror state: pending, synced, removed, or error.';
