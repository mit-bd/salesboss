
-- 1. Add unique constraint on customers.mobile_number to prevent duplicates
ALTER TABLE public.customers ADD CONSTRAINT customers_mobile_number_unique UNIQUE (mobile_number);

-- 2. Fix SKU-based ID generation trigger to use FOR UPDATE locking (atomic increment)
CREATE OR REPLACE FUNCTION public.generate_sku_order_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sku text;
  v_seq integer;
BEGIN
  IF NEW.product_id IS NOT NULL AND (NEW.generated_order_id IS NULL OR NEW.generated_order_id = '') THEN
    SELECT sku INTO v_sku FROM public.products WHERE id = NEW.product_id;
    
    IF v_sku IS NOT NULL AND v_sku != '' THEN
      SELECT COALESCE(MAX(order_sequence_number), 0) + 1
      INTO v_seq
      FROM public.orders
      WHERE product_sku = v_sku
      FOR UPDATE;
      
      NEW.product_sku := v_sku;
      NEW.order_sequence_number := v_seq;
      NEW.generated_order_id := v_sku || '*' || v_seq;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Fix find_or_create_customer to handle race conditions with advisory lock
CREATE OR REPLACE FUNCTION public.find_or_create_customer(p_name text, p_mobile text, p_address text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_lock_key bigint;
BEGIN
  -- Use advisory lock based on mobile hash to prevent concurrent duplicate creation
  v_lock_key := hashtext(p_mobile);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Try to find existing customer
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE mobile_number = p_mobile;

  IF v_customer_id IS NOT NULL THEN
    IF p_address IS NOT NULL AND p_address != '' THEN
      UPDATE public.customers
      SET address = p_address, name = COALESCE(NULLIF(p_name, ''), name), updated_at = now()
      WHERE id = v_customer_id;
    END IF;
    RETURN v_customer_id;
  END IF;

  -- Create new customer (unique constraint prevents duplicates even without lock)
  INSERT INTO public.customers (name, mobile_number, address)
  VALUES (p_name, p_mobile, p_address)
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$function$;
