
-- 1. Columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid,
  ADD COLUMN IF NOT EXISTS previous_status text;

CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders (deleted_at) WHERE is_deleted = true;

-- 2. DB-level guard: only admin/owner may flip is_deleted
CREATE OR REPLACE FUNCTION public.enforce_order_delete_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_deleted IS DISTINCT FROM NEW.is_deleted THEN
    IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'owner'::app_role)) THEN
      RAISE EXCEPTION 'Only Admin or Owner can delete or restore orders'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_delete_admin_only ON public.orders;
CREATE TRIGGER trg_enforce_order_delete_admin_only
BEFORE UPDATE OF is_deleted ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_delete_admin_only();

-- 3. RPC: soft delete
CREATE OR REPLACE FUNCTION public.soft_delete_order(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Owner may act cross-project; Admin only within their own project
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

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, description, actor_name, actor_id)
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
$$;

REVOKE ALL ON FUNCTION public.soft_delete_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_order(uuid, text) TO authenticated;

-- 4. RPC: restore
CREATE OR REPLACE FUNCTION public.restore_deleted_order(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.order_activity_logs(order_id, project_id, action_type, description, actor_name, actor_id)
  VALUES (
    p_order_id, v_order.project_id, 'Order Restored',
    'Order restored by ' || COALESCE(NULLIF(v_actor_name,''), 'admin')
      || ' (status restored to: ' || v_restore_status || ')',
    COALESCE(NULLIF(v_actor_name,''), 'admin'),
    v_user
  );

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'restored_status', v_restore_status);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_deleted_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_deleted_order(uuid) TO authenticated;
