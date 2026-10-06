-- Enforce a hard minimum of 100 units for wholesale items.
CREATE OR REPLACE FUNCTION public.enforce_wholesale_minimum_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_type = 'wholesale' AND COALESCE(NEW.quantity, 0) < 100 THEN
    RAISE EXCEPTION 'Minimum quantity is 100'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_wholesale_minimum_quantity
ON public.shoppinghub_order_items;

CREATE TRIGGER trg_enforce_wholesale_minimum_quantity
BEFORE INSERT OR UPDATE OF quantity, customer_type
ON public.shoppinghub_order_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_wholesale_minimum_quantity();
