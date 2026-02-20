
-- Create a version-checked bulk update function that aborts the entire batch on any conflict
CREATE OR REPLACE FUNCTION public.bulk_update_orders_with_lock(
  p_order_ids uuid[],
  p_versions jsonb,  -- JSON object mapping order_id -> expected updated_at timestamp
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  conflict_ids uuid[] := '{}';
  affected_count integer := 0;
  v_order_id uuid;
  v_expected_ts timestamptz;
  v_actual_ts timestamptz;
BEGIN
  -- Phase 1: Check all versions match
  FOREACH v_order_id IN ARRAY p_order_ids LOOP
    -- Get the expected timestamp from the versions map
    v_expected_ts := (p_versions ->> v_order_id::text)::timestamptz;

    -- Get the actual timestamp from the database
    SELECT updated_at INTO v_actual_ts
    FROM public.orders
    WHERE id = v_order_id AND is_deleted = false
    FOR UPDATE;  -- Lock the row

    IF v_actual_ts IS NULL THEN
      -- Order not found or deleted, treat as conflict
      conflict_ids := array_append(conflict_ids, v_order_id);
    ELSIF v_expected_ts IS NULL OR v_actual_ts != v_expected_ts THEN
      -- Version mismatch
      conflict_ids := array_append(conflict_ids, v_order_id);
    END IF;
  END LOOP;

  -- Phase 2: If any conflicts, abort entire batch
  IF array_length(conflict_ids, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict_ids', to_jsonb(conflict_ids),
      'affected_count', 0
    );
  END IF;

  -- Phase 3: All versions match, perform the update
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

  RETURN jsonb_build_object(
    'success', true,
    'conflict_ids', '[]'::jsonb,
    'affected_count', affected_count
  );
END;
$function$;

-- Create a version-checked bulk followup completion function
CREATE OR REPLACE FUNCTION public.bulk_complete_followups_with_lock(
  p_order_ids uuid[],
  p_versions jsonb,
  p_step_number integer,
  p_note text,
  p_next_followup_date date,
  p_completed_by uuid,
  p_completed_by_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  conflict_ids uuid[] := '{}';
  affected_count integer := 0;
  v_order_id uuid;
  v_expected_ts timestamptz;
  v_actual_ts timestamptz;
  v_is_final boolean;
BEGIN
  v_is_final := (p_step_number = 5);

  -- Phase 1: Check all versions match
  FOREACH v_order_id IN ARRAY p_order_ids LOOP
    v_expected_ts := (p_versions ->> v_order_id::text)::timestamptz;

    SELECT updated_at INTO v_actual_ts
    FROM public.orders
    WHERE id = v_order_id AND is_deleted = false
    FOR UPDATE;

    IF v_actual_ts IS NULL THEN
      conflict_ids := array_append(conflict_ids, v_order_id);
    ELSIF v_expected_ts IS NULL OR v_actual_ts != v_expected_ts THEN
      conflict_ids := array_append(conflict_ids, v_order_id);
    END IF;
  END LOOP;

  -- Phase 2: Abort on any conflict
  IF array_length(conflict_ids, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict_ids', to_jsonb(conflict_ids),
      'affected_count', 0
    );
  END IF;

  -- Phase 3: Insert followup history records
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

  -- Phase 4: Update orders
  UPDATE public.orders
  SET
    current_status = 'completed',
    followup_date = CASE WHEN v_is_final THEN NULL ELSE p_next_followup_date END,
    health = CASE WHEN v_is_final THEN 'good' ELSE health END,
    updated_at = now()
  WHERE id = ANY(p_order_ids)
    AND is_deleted = false;

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'conflict_ids', '[]'::jsonb,
    'affected_count', affected_count
  );
END;
$function$;
