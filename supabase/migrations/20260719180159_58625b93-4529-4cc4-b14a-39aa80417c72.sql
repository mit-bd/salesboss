
-- ==== Phase: Recycle Bin — Bulk Permanent Delete ====

-- 1) Permission
INSERT INTO public.permissions (key, label, category)
VALUES ('orders.hard_delete', 'Permanent Delete Order', 'Orders')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
VALUES ('admin','orders.hard_delete')
ON CONFLICT DO NOTHING;

-- 2) Audit table
CREATE TABLE IF NOT EXISTS public.hard_delete_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  user_name text,
  order_count integer NOT NULL DEFAULT 0,
  order_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  order_summaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  ip_address text,
  user_agent text,
  bd_date text,
  bd_time text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.hard_delete_audit_log TO authenticated;
GRANT ALL ON public.hard_delete_audit_log TO service_role;

ALTER TABLE public.hard_delete_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view all hard-delete audit" ON public.hard_delete_audit_log;
CREATE POLICY "Owners view all hard-delete audit"
  ON public.hard_delete_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner'::app_role));

DROP POLICY IF EXISTS "Project members view hard-delete audit" ON public.hard_delete_audit_log;
CREATE POLICY "Project members view hard-delete audit"
  ON public.hard_delete_audit_log FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

DROP POLICY IF EXISTS "Authenticated insert hard-delete audit" ON public.hard_delete_audit_log;
CREATE POLICY "Authenticated insert hard-delete audit"
  ON public.hard_delete_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_hard_delete_audit_project_created
  ON public.hard_delete_audit_log(project_id, created_at DESC);

-- 3) Dependency inspector
CREATE OR REPLACE FUNCTION public.check_hard_delete_dependencies(p_order_ids uuid[])
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
  v_scoped_ids uuid[];
  v_orders int := 0;
  v_customers int := 0;
  v_followups int := 0;
  v_activity int := 0;
  v_notif int := 0;
  v_repeat int := 0;
  v_commission int := 0;
  v_memory int := 0;
  v_children int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;
  IF p_order_ids IS NULL OR array_length(p_order_ids,1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'orders', 0);
  END IF;

  v_is_owner := public.has_role(v_user,'owner'::app_role);
  v_is_priv := v_is_owner
            OR public.has_role(v_user,'admin'::app_role)
            OR EXISTS (SELECT 1 FROM public.role_permissions rp
                       JOIN public.user_roles ur ON ur.role=rp.role
                       WHERE ur.user_id=v_user AND rp.permission_key='orders.hard_delete');
  IF NOT v_is_priv THEN
    RAISE EXCEPTION 'Not permitted' USING ERRCODE='42501';
  END IF;

  IF NOT v_is_owner THEN
    v_project := public.get_user_project_id(v_user);
    SELECT COALESCE(array_agg(id), '{}'::uuid[])
      INTO v_scoped_ids
      FROM public.orders
     WHERE id = ANY(p_order_ids) AND project_id = v_project;
  ELSE
    v_scoped_ids := p_order_ids;
  END IF;

  SELECT count(*), count(DISTINCT customer_id)
    INTO v_orders, v_customers
    FROM public.orders WHERE id = ANY(v_scoped_ids);

  SELECT count(*) INTO v_followups FROM public.followup_history WHERE order_id = ANY(v_scoped_ids);
  SELECT count(*) INTO v_activity  FROM public.order_activity_logs WHERE order_id = ANY(v_scoped_ids);
  SELECT count(*) INTO v_notif     FROM public.notifications WHERE order_id = ANY(v_scoped_ids);
  SELECT count(*) INTO v_repeat    FROM public.repeat_order_records
    WHERE child_order_id = ANY(v_scoped_ids) OR parent_order_id = ANY(v_scoped_ids);
  SELECT count(*) INTO v_commission FROM public.commission_entries WHERE order_id = ANY(v_scoped_ids);
  SELECT count(*) INTO v_memory    FROM public.customer_memory_events WHERE order_id = ANY(v_scoped_ids);
  SELECT count(*) INTO v_children  FROM public.orders WHERE parent_order_id = ANY(v_scoped_ids);

  RETURN jsonb_build_object(
    'ok', true,
    'orders', v_orders,
    'customers', v_customers,
    'followups', v_followups,
    'activity_logs', v_activity,
    'notifications', v_notif,
    'repeat_records', v_repeat,
    'commission_entries', v_commission,
    'memory_events', v_memory,
    'child_orders', v_children,
    'has_dependencies', (v_followups + v_activity + v_repeat + v_commission + v_memory + v_children) > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_hard_delete_dependencies(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_hard_delete_dependencies(uuid[]) TO authenticated;

-- 4) Bulk permanent delete
CREATE OR REPLACE FUNCTION public.bulk_hard_delete_orders(
  p_order_ids uuid[],
  p_reason text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
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
  v_ids uuid[];
  v_deleted int := 0;
  v_customers uuid[];
  v_cid uuid;
  v_deps jsonb;
  v_summaries jsonb;
  v_project_for_audit uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;
  IF p_order_ids IS NULL OR array_length(p_order_ids,1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0);
  END IF;

  v_is_owner := public.has_role(v_user,'owner'::app_role);
  v_is_priv := v_is_owner
            OR public.has_role(v_user,'admin'::app_role)
            OR EXISTS (SELECT 1 FROM public.role_permissions rp
                       JOIN public.user_roles ur ON ur.role=rp.role
                       WHERE ur.user_id=v_user AND rp.permission_key='orders.hard_delete');
  IF NOT v_is_priv THEN
    RAISE EXCEPTION 'Only Admin or Owner can permanently delete orders' USING ERRCODE='42501';
  END IF;

  IF NOT v_is_owner THEN
    v_project := public.get_user_project_id(v_user);
    IF v_project IS NULL THEN
      RAISE EXCEPTION 'No project scope for user' USING ERRCODE='42501';
    END IF;
    SELECT COALESCE(array_agg(id), '{}'::uuid[])
      INTO v_ids FROM public.orders
     WHERE id = ANY(p_order_ids) AND project_id = v_project AND is_deleted = true;
  ELSE
    SELECT COALESCE(array_agg(id), '{}'::uuid[])
      INTO v_ids FROM public.orders
     WHERE id = ANY(p_order_ids) AND is_deleted = true;
  END IF;

  IF v_ids IS NULL OR array_length(v_ids,1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0,
      'note', 'No matching soft-deleted orders in scope');
  END IF;

  SELECT COALESCE(full_name,'') INTO v_actor_name FROM public.profiles WHERE user_id = v_user;

  -- Snapshot deps + summaries + affected customers + project for audit BEFORE delete
  v_deps := public.check_hard_delete_dependencies(v_ids);

  SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'external_order_id', external_order_id,
      'generated_order_id', generated_order_id, 'invoice_id', invoice_id,
      'customer_name', customer_name, 'mobile', mobile,
      'price', price, 'current_status', current_status
    ) ORDER BY deleted_at DESC)
    INTO v_summaries
    FROM public.orders WHERE id = ANY(v_ids);

  SELECT array_agg(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL)
    INTO v_customers FROM public.orders WHERE id = ANY(v_ids);

  SELECT project_id INTO v_project_for_audit FROM public.orders WHERE id = ANY(v_ids) LIMIT 1;

  -- Detach child orders so parent removal succeeds without cascading real orders
  UPDATE public.orders SET parent_order_id = NULL
    WHERE parent_order_id = ANY(v_ids);

  -- Remove repeat_order_records where either side is being deleted
  DELETE FROM public.repeat_order_records
   WHERE child_order_id = ANY(v_ids) OR parent_order_id = ANY(v_ids);

  -- Delete (FKs handle followup_history / activity / notifications via CASCADE;
  --        commission_entries + customer_memory_events via SET NULL)
  DELETE FROM public.orders WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Recalculate customer analytics
  IF v_customers IS NOT NULL THEN
    FOREACH v_cid IN ARRAY v_customers LOOP
      BEGIN
        PERFORM public.recalc_customer_analytics(v_cid);
        PERFORM public.apply_customer_tags(v_cid);
        PERFORM public.mark_ai_profile_dirty(v_cid);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END IF;

  -- Audit
  INSERT INTO public.hard_delete_audit_log(
    project_id, user_id, user_name, order_count, order_ids,
    order_summaries, dependencies, reason, ip_address, user_agent,
    bd_date, bd_time
  ) VALUES (
    v_project_for_audit, v_user, COALESCE(NULLIF(v_actor_name,''),'admin'),
    v_deleted, v_ids, COALESCE(v_summaries,'[]'::jsonb), v_deps,
    NULLIF(TRIM(COALESCE(p_reason,'')),''),
    p_ip, p_user_agent,
    to_char((now() AT TIME ZONE 'Asia/Dhaka'),'YYYY-MM-DD'),
    to_char((now() AT TIME ZONE 'Asia/Dhaka'),'HH24:MI:SS')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'deleted', v_deleted,
    'dependencies', v_deps,
    'duration_ms', round(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_hard_delete_orders(uuid[], text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_hard_delete_orders(uuid[], text, text, text) TO authenticated;
