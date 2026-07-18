
-- Fix: order_activity_logs actual columns are (action_description, user_name, user_id),
-- but the four order delete/restore RPCs were inserting into (description, actor_name, actor_id).

CREATE OR REPLACE FUNCTION public.bulk_soft_delete_orders(p_order_ids uuid[], p_reason text DEFAULT 'Bulk Delete'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_owner boolean;
  v_is_priv boolean;
  v_project uuid;
  v_actor_name text;
  v_started timestamptz := clock_timestamp();
  v_affected int := 0;
  v_reason text := COALESCE(NULLIF(TRIM(p_reason), ''), 'Bulk Delete');
  v_customers uuid[];
  v_cid uuid;
  v_batch_project uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'affected', 0);
  END IF;

  v_is_owner := public.has_role(v_user, 'owner'::app_role);
  v_is_priv := v_is_owner OR public.has_role(v_user, 'admin'::app_role);
  IF NOT v_is_priv THEN
    RAISE EXCEPTION 'Only Admin or Owner can delete orders' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_owner THEN
    v_project := public.get_user_project_id(v_user);
    IF v_project IS NULL THEN
      RAISE EXCEPTION 'No project scope for user' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COALESCE(full_name, '') INTO v_actor_name FROM public.profiles WHERE user_id = v_user;

  WITH upd AS (
    UPDATE public.orders o
       SET is_deleted = true,
           deleted_at = now(),
           deleted_by = v_user,
           deletion_reason = v_reason,
           previous_status = COALESCE(o.previous_status, o.current_status),
           restored_at = NULL,
           restored_by = NULL,
           updated_at = now()
     WHERE o.id = ANY(p_order_ids)
       AND o.is_deleted = false
       AND (v_is_owner OR o.project_id = v_project)
    RETURNING o.id, o.project_id, o.customer_id, o.current_status
  ),
  agg AS (
    SELECT count(*)::int AS cnt,
           array_agg(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL) AS customers,
           (SELECT project_id FROM upd LIMIT 1) AS batch_project
    FROM upd
  )
  SELECT cnt, customers, batch_project
    INTO v_affected, v_customers, v_batch_project
  FROM agg;

  IF COALESCE(v_affected, 0) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'affected', 0);
  END IF;

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, action_description, user_name, user_id)
  SELECT o.id, o.project_id, 'Order Deleted',
         'Bulk delete by ' || COALESCE(NULLIF(v_actor_name, ''), 'admin')
           || ' — Reason: ' || v_reason,
         COALESCE(NULLIF(v_actor_name, ''), 'admin'),
         v_user
  FROM public.orders o
  WHERE o.id = ANY(p_order_ids) AND o.deleted_by = v_user AND o.deleted_at >= v_started;

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, action_description, user_name, user_id)
  SELECT id, v_batch_project, 'Bulk Delete Batch',
         'Bulk delete batch: ' || v_affected || ' orders in '
           || round(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::text || ' ms',
         COALESCE(NULLIF(v_actor_name, ''), 'admin'), v_user
  FROM public.orders
  WHERE id = ANY(p_order_ids) AND deleted_by = v_user AND deleted_at >= v_started
  ORDER BY deleted_at
  LIMIT 1;

  IF v_customers IS NOT NULL THEN
    FOREACH v_cid IN ARRAY v_customers LOOP
      PERFORM public.recalc_customer_analytics(v_cid);
      PERFORM public.apply_customer_tags(v_cid);
      PERFORM public.mark_ai_profile_dirty(v_cid);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'affected', v_affected,
    'duration_ms', round(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_restore_orders(p_order_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_owner boolean;
  v_is_priv boolean;
  v_project uuid;
  v_actor_name text;
  v_started timestamptz := clock_timestamp();
  v_affected int := 0;
  v_customers uuid[];
  v_cid uuid;
  v_batch_project uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'affected', 0);
  END IF;

  v_is_owner := public.has_role(v_user, 'owner'::app_role);
  v_is_priv := v_is_owner OR public.has_role(v_user, 'admin'::app_role);
  IF NOT v_is_priv THEN
    RAISE EXCEPTION 'Only Admin or Owner can restore orders' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_owner THEN
    v_project := public.get_user_project_id(v_user);
    IF v_project IS NULL THEN
      RAISE EXCEPTION 'No project scope for user' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COALESCE(full_name, '') INTO v_actor_name FROM public.profiles WHERE user_id = v_user;

  WITH upd AS (
    UPDATE public.orders o
       SET is_deleted = false,
           current_status = COALESCE(o.previous_status, o.current_status, 'pending'),
           restored_at = now(),
           restored_by = v_user,
           previous_status = NULL,
           updated_at = now()
     WHERE o.id = ANY(p_order_ids)
       AND o.is_deleted = true
       AND (v_is_owner OR o.project_id = v_project)
    RETURNING o.id, o.project_id, o.customer_id
  ),
  agg AS (
    SELECT count(*)::int AS cnt,
           array_agg(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL) AS customers,
           (SELECT project_id FROM upd LIMIT 1) AS batch_project
    FROM upd
  )
  SELECT cnt, customers, batch_project
    INTO v_affected, v_customers, v_batch_project
  FROM agg;

  IF COALESCE(v_affected, 0) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'affected', 0);
  END IF;

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, action_description, user_name, user_id)
  SELECT o.id, o.project_id, 'Order Restored',
         'Bulk restore by ' || COALESCE(NULLIF(v_actor_name, ''), 'admin'),
         COALESCE(NULLIF(v_actor_name, ''), 'admin'), v_user
  FROM public.orders o
  WHERE o.id = ANY(p_order_ids) AND o.restored_by = v_user AND o.restored_at >= v_started;

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, action_description, user_name, user_id)
  SELECT id, v_batch_project, 'Bulk Restore Batch',
         'Bulk restore batch: ' || v_affected || ' orders in '
           || round(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::text || ' ms',
         COALESCE(NULLIF(v_actor_name, ''), 'admin'), v_user
  FROM public.orders
  WHERE id = ANY(p_order_ids) AND restored_by = v_user AND restored_at >= v_started
  ORDER BY restored_at
  LIMIT 1;

  IF v_customers IS NOT NULL THEN
    FOREACH v_cid IN ARRAY v_customers LOOP
      PERFORM public.recalc_customer_analytics(v_cid);
      PERFORM public.apply_customer_tags(v_cid);
      PERFORM public.mark_ai_profile_dirty(v_cid);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'affected', v_affected,
    'duration_ms', round(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_order(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_priv boolean;
  v_project uuid;
  v_order record;
  v_actor_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_is_priv := public.has_role(v_user, 'admin'::app_role)
            OR public.has_role(v_user, 'owner'::app_role);

  IF NOT v_is_priv THEN
    RAISE EXCEPTION 'Only Admin or Owner can delete orders' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.is_deleted THEN
    RAISE EXCEPTION 'Order is already deleted' USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_role(v_user, 'owner'::app_role) THEN
    v_project := public.get_user_project_id(v_user);
    IF v_project IS NULL OR v_project <> v_order.project_id THEN
      RAISE EXCEPTION 'Order not in your project' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COALESCE(full_name, '') INTO v_actor_name FROM public.profiles WHERE user_id = v_user;

  UPDATE public.orders
     SET is_deleted = true,
         deleted_at = now(),
         deleted_by = v_user,
         deletion_reason = NULLIF(TRIM(p_reason), ''),
         previous_status = COALESCE(previous_status, current_status),
         restored_at = NULL,
         restored_by = NULL,
         updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, action_description, user_name, user_id)
  VALUES (
    p_order_id, v_order.project_id, 'Order Deleted',
    'Order soft-deleted by ' || COALESCE(NULLIF(v_actor_name, ''), 'admin')
      || CASE WHEN NULLIF(TRIM(p_reason),'') IS NOT NULL THEN ' — Reason: ' || TRIM(p_reason) ELSE '' END
      || ' (previous status: ' || COALESCE(v_order.current_status, 'unknown') || ')',
    COALESCE(NULLIF(v_actor_name, ''), 'admin'),
    v_user
  );

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_deleted_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_priv boolean;
  v_project uuid;
  v_order record;
  v_actor_name text;
  v_restore_status text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_is_priv := public.has_role(v_user, 'admin'::app_role)
            OR public.has_role(v_user, 'owner'::app_role);

  IF NOT v_is_priv THEN
    RAISE EXCEPTION 'Only Admin or Owner can restore orders' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_order.is_deleted THEN
    RAISE EXCEPTION 'Order is not deleted' USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_role(v_user, 'owner'::app_role) THEN
    v_project := public.get_user_project_id(v_user);
    IF v_project IS NULL OR v_project <> v_order.project_id THEN
      RAISE EXCEPTION 'Order not in your project' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COALESCE(full_name, '') INTO v_actor_name FROM public.profiles WHERE user_id = v_user;

  v_restore_status := COALESCE(v_order.previous_status, v_order.current_status, 'pending');

  UPDATE public.orders
     SET is_deleted = false,
         current_status = v_restore_status,
         restored_at = now(),
         restored_by = v_user,
         previous_status = NULL,
         updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, action_description, user_name, user_id)
  VALUES (
    p_order_id, v_order.project_id, 'Order Restored',
    'Order restored by ' || COALESCE(NULLIF(v_actor_name,''), 'admin')
      || ' (status restored to: ' || v_restore_status || ')',
    COALESCE(NULLIF(v_actor_name,''), 'admin'),
    v_user
  );

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'restored_status', v_restore_status);
END;
$function$;
