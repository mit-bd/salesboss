
CREATE OR REPLACE FUNCTION public.advance_followup_steps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  count1 integer := 0;
  count2 integer := 0;
BEGIN
  -- Advance orders where datetime-based trigger has passed (test mode)
  UPDATE public.orders o
  SET 
    followup_step = o.followup_step + 1,
    current_status = 'pending',
    followup_date = (
      SELECT fh.next_followup_date 
      FROM public.followup_history fh 
      WHERE fh.order_id = o.id AND fh.step_number = o.followup_step 
      ORDER BY fh.completed_at DESC LIMIT 1
    ),
    next_followup_datetime = NULL,
    updated_at = now()
  WHERE 
    o.is_deleted = false
    AND o.current_status = 'completed'
    AND o.followup_step < 5
    AND o.next_followup_datetime IS NOT NULL
    AND o.next_followup_datetime <= now();

  GET DIAGNOSTICS count1 = ROW_COUNT;

  -- Also advance date-based orders (original logic)
  UPDATE public.orders o
  SET 
    followup_step = o.followup_step + 1,
    current_status = 'pending',
    followup_date = (
      SELECT fh.next_followup_date 
      FROM public.followup_history fh 
      WHERE fh.order_id = o.id AND fh.step_number = o.followup_step 
      ORDER BY fh.completed_at DESC LIMIT 1
    ),
    updated_at = now()
  WHERE 
    o.is_deleted = false
    AND o.current_status = 'completed'
    AND o.followup_step < 5
    AND o.next_followup_datetime IS NULL
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      WHERE fh.order_id = o.id 
        AND fh.step_number = o.followup_step
        AND fh.next_followup_date IS NOT NULL
        AND fh.next_followup_date <= CURRENT_DATE
    );

  GET DIAGNOSTICS count2 = ROW_COUNT;
  RETURN count1 + count2;
END;
$function$;
