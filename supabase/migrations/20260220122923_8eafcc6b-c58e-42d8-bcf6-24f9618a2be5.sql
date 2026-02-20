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
      -- Use a subquery to avoid FOR UPDATE with aggregate
      SELECT COALESCE(max_seq, 0) + 1 INTO v_seq
      FROM (
        SELECT MAX(order_sequence_number) as max_seq
        FROM public.orders
        WHERE product_sku = v_sku
      ) sub;
      
      NEW.product_sku := v_sku;
      NEW.order_sequence_number := v_seq;
      NEW.generated_order_id := v_sku || '*' || v_seq;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;