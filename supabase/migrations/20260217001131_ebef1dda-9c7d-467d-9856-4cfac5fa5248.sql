
-- Add item_description column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS item_description text NOT NULL DEFAULT '';

-- Add SKU-based order ID columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_sku text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_sequence_number integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS generated_order_id text NOT NULL DEFAULT '';

-- Create unique index on generated_order_id (only for non-empty values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_generated_order_id 
ON public.orders (generated_order_id) 
WHERE generated_order_id != '';

-- Create atomic function to get next sequence number for a product SKU
CREATE OR REPLACE FUNCTION public.get_next_sku_sequence(p_sku text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_seq integer;
BEGIN
  -- Atomically get the max sequence for this SKU and increment
  SELECT COALESCE(MAX(order_sequence_number), 0) + 1
  INTO next_seq
  FROM public.orders
  WHERE product_sku = p_sku
  FOR UPDATE;
  
  RETURN next_seq;
END;
$$;

-- Create a trigger function that auto-generates the SKU-based order ID on insert
CREATE OR REPLACE FUNCTION public.generate_sku_order_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sku text;
  v_seq integer;
BEGIN
  -- Only generate if product_id is set and generated_order_id is empty
  IF NEW.product_id IS NOT NULL AND (NEW.generated_order_id IS NULL OR NEW.generated_order_id = '') THEN
    -- Get the product SKU
    SELECT sku INTO v_sku FROM public.products WHERE id = NEW.product_id;
    
    IF v_sku IS NOT NULL AND v_sku != '' THEN
      -- Get next sequence atomically
      SELECT COALESCE(MAX(order_sequence_number), 0) + 1
      INTO v_seq
      FROM public.orders
      WHERE product_sku = v_sku;
      
      NEW.product_sku := v_sku;
      NEW.order_sequence_number := v_seq;
      NEW.generated_order_id := v_sku || '*' || v_seq;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_generate_sku_order_id ON public.orders;
CREATE TRIGGER trg_generate_sku_order_id
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_sku_order_id();
