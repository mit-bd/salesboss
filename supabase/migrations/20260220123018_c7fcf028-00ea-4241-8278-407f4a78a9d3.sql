CREATE OR REPLACE FUNCTION public.get_next_sku_sequence(p_sku text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_seq integer;
BEGIN
  SELECT COALESCE(MAX(order_sequence_number), 0) + 1
  INTO next_seq
  FROM public.orders
  WHERE product_sku = p_sku;
  
  RETURN next_seq;
END;
$function$;