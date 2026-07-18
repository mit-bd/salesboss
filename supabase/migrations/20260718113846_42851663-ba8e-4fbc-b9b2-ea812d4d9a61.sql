
CREATE OR REPLACE FUNCTION public.bulk_soft_delete_orders(
  p_order_ids uuid[],
  p_reason text DEFAULT 'Bulk Delete'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Batch update (only rows the caller is allowed to touch)
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
  )
  SELECT count(*), array_agg(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL), MIN(project_id)
    INTO v_affected, v_customers, v_batch_project
  FROM upd;

  IF COALESCE(v_affected, 0) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'affected', 0);
  END IF;

  -- Per-order activity log
  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, description, actor_name, actor_id)
  SELECT o.id, o.project_id, 'Order Deleted',
         'Bulk delete by ' || COALESCE(NULLIF(v_actor_name, ''), 'admin')
           || ' — Reason: ' || v_reason,
         COALESCE(NULLIF(v_actor_name, ''), 'admin'),
         v_user
  FROM public.orders o
  WHERE o.id = ANY(p_order_ids) AND o.deleted_by = v_user AND o.deleted_at >= v_started;

  -- Batch summary entry (attached to first affected order for traceability)
  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, description, actor_name, actor_id)
  SELECT id, v_batch_project, 'Bulk Delete Batch',
         'Bulk delete batch: ' || v_affected || ' orders in '
           || round(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::text || ' ms',
         COALESCE(NULLIF(v_actor_name, ''), 'admin'), v_user
  FROM public.orders
  WHERE id = ANY(p_order_ids) AND deleted_by = v_user AND deleted_at >= v_started
  ORDER BY deleted_at
  LIMIT 1;

  -- Recalculate impacted customers
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
$$;

REVOKE ALL ON FUNCTION public.bulk_soft_delete_orders(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_soft_delete_orders(uuid[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_restore_orders(
  p_order_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  )
  SELECT count(*), array_agg(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL), MIN(project_id)
    INTO v_affected, v_customers, v_batch_project
  FROM upd;

  IF COALESCE(v_affected, 0) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'affected', 0);
  END IF;

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, description, actor_name, actor_id)
  SELECT o.id, o.project_id, 'Order Restored',
         'Bulk restore by ' || COALESCE(NULLIF(v_actor_name, ''), 'admin'),
         COALESCE(NULLIF(v_actor_name, ''), 'admin'), v_user
  FROM public.orders o
  WHERE o.id = ANY(p_order_ids) AND o.restored_by = v_user AND o.restored_at >= v_started;

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, description, actor_name, actor_id)
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
$$;

REVOKE ALL ON FUNCTION public.bulk_restore_orders(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_restore_orders(uuid[]) TO authenticated;
