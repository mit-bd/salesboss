
CREATE OR REPLACE FUNCTION public.advance_followup_steps()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_count integer := 0;
BEGIN
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
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      WHERE fh.order_id = o.id 
        AND fh.step_number = o.followup_step
        AND fh.next_followup_date IS NOT NULL
        AND fh.next_followup_date <= CURRENT_DATE
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$function$;
