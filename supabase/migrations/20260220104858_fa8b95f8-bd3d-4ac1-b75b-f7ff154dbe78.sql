
-- 1. Unique constraint on generated_order_id (only for non-empty values)
CREATE UNIQUE INDEX IF NOT EXISTS orders_generated_order_id_unique 
ON public.orders (generated_order_id) 
WHERE generated_order_id IS NOT NULL AND generated_order_id != '';

-- 2. Create atomic bulk update function for transactional safety
CREATE OR REPLACE FUNCTION public.bulk_update_orders(
  p_order_ids uuid[],
  p_updates jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected_count integer := 0;
BEGIN
  UPDATE public.orders
  SET
    assigned_to = CASE WHEN p_updates ? 'assigned_to' THEN (p_updates->>'assigned_to')::uuid ELSE assigned_to END,
    assigned_to_name = CASE WHEN p_updates ? 'assigned_to_name' THEN p_updates->>'assigned_to_name' ELSE assigned_to_name END,
    delivery_method = CASE WHEN p_updates ? 'delivery_method' THEN p_updates->>'delivery_method' ELSE delivery_method END,
    order_source = CASE WHEN p_updates ? 'order_source' THEN p_updates->>'order_source' ELSE order_source END,
    followup_date = CASE WHEN p_updates ? 'followup_date' THEN (p_updates->>'followup_date')::date ELSE followup_date END,
    price = CASE WHEN p_updates ? 'price' THEN (p_updates->>'price')::numeric ELSE price END,
    current_status = CASE WHEN p_updates ? 'current_status' THEN p_updates->>'current_status' ELSE current_status END,
    health = CASE WHEN p_updates ? 'health' THEN p_updates->>'health' ELSE health END,
    updated_at = now()
  WHERE id = ANY(p_order_ids)
    AND is_deleted = false;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$function$;

-- 3. Create atomic bulk followup completion function
CREATE OR REPLACE FUNCTION public.bulk_complete_followups(
  p_order_ids uuid[],
  p_step_number integer,
  p_note text,
  p_next_followup_date date,
  p_completed_by uuid,
  p_completed_by_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected_count integer := 0;
  v_order_id uuid;
  v_is_final boolean;
BEGIN
  v_is_final := (p_step_number = 5);

  -- Insert followup history records for each order
  INSERT INTO public.followup_history (order_id, step_number, note, problems_discussed, upsell_attempted, upsell_details, next_followup_date, completed_by, completed_by_name)
  SELECT 
    unnest(p_order_ids),
    p_step_number,
    p_note,
    '',
    false,
    '',
    CASE WHEN v_is_final THEN NULL ELSE p_next_followup_date END,
    p_completed_by,
    p_completed_by_name;

  -- Update all orders atomically
  UPDATE public.orders
  SET
    current_status = 'completed',
    followup_date = CASE WHEN v_is_final THEN NULL ELSE p_next_followup_date END,
    health = CASE WHEN v_is_final THEN 'good' ELSE health END,
    updated_at = now()
  WHERE id = ANY(p_order_ids)
    AND is_deleted = false;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$function$;

-- 4. Add index for performance on bulk operations
CREATE INDEX IF NOT EXISTS idx_orders_is_deleted ON public.orders (is_deleted);
CREATE INDEX IF NOT EXISTS idx_orders_followup_step_status ON public.orders (followup_step, current_status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_followup_history_order_id ON public.followup_history (order_id);
