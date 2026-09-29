-- Automatically associate WhatsApp retailer mappings with the closest ShoppingHub product.
-- This fixes mappings where the WhatsApp/catalog title and the ShoppingHub product
-- title are slightly different (for example, "Natural coir scrubber pack of 5"
-- vs "Coir Scrubber Pack of 5").

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.link_marketplace_mapping_to_product()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  matched_id UUID;
  matched_name TEXT;
BEGIN
  -- Never overwrite an explicit product link.
  IF NEW.product_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.id, p.name
  INTO matched_id, matched_name
  FROM public.products p
  WHERE COALESCE(btrim(NEW.product_name), '') <> ''
    AND (
      similarity(lower(p.name), lower(NEW.product_name)) >= 0.45
      OR lower(p.name) LIKE '%' || lower(NEW.product_name) || '%'
      OR lower(NEW.product_name) LIKE '%' || lower(p.name) || '%'
    )
  ORDER BY
    CASE WHEN lower(p.name) = lower(NEW.product_name) THEN 0 ELSE 1 END,
    similarity(lower(p.name), lower(NEW.product_name)) DESC,
    p.id
  LIMIT 1;

  IF matched_id IS NOT NULL THEN
    NEW.product_id := matched_id;
    NEW.product_name := matched_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shoppinghub_marketplace_map_auto_link_product
  ON public.shoppinghub_marketplace_map;

CREATE TRIGGER shoppinghub_marketplace_map_auto_link_product
  BEFORE INSERT OR UPDATE OF product_name, product_id
  ON public.shoppinghub_marketplace_map
  FOR EACH ROW
  EXECUTE FUNCTION public.link_marketplace_mapping_to_product();

-- Backfill mappings that were created before the trigger existed.
WITH ranked_matches AS (
  SELECT
    m.whatsapp_retailer_id,
    p.id AS product_id,
    p.name AS product_name,
    ROW_NUMBER() OVER (
      PARTITION BY m.whatsapp_retailer_id
      ORDER BY
        CASE WHEN lower(p.name) = lower(m.product_name) THEN 0 ELSE 1 END,
        similarity(lower(p.name), lower(m.product_name)) DESC,
        p.id
    ) AS rn
  FROM public.shoppinghub_marketplace_map m
  JOIN public.products p
    ON COALESCE(btrim(m.product_name), '') <> ''
   AND (
      similarity(lower(p.name), lower(m.product_name)) >= 0.45
      OR lower(p.name) LIKE '%' || lower(m.product_name) || '%'
      OR lower(m.product_name) LIKE '%' || lower(p.name) || '%'
   )
  WHERE m.product_id IS NULL
)
UPDATE public.shoppinghub_marketplace_map m
SET product_id = r.product_id,
    product_name = r.product_name,
    updated_at = NOW()
FROM ranked_matches r
WHERE r.rn = 1
  AND r.whatsapp_retailer_id = m.whatsapp_retailer_id;
