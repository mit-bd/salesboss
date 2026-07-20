
-- Team member detail (profile + role + auth email/last sign-in)
CREATE OR REPLACE FUNCTION public.get_team_member_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role app_role;
  v_caller_project uuid;
  v_p record;
  v_role app_role;
  v_email text;
  v_created timestamptz;
  v_last_sign_in timestamptz;
  v_banned_until timestamptz;
  v_sup_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_caller_role FROM public.user_roles WHERE user_id = v_caller LIMIT 1;
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'No role assigned' USING ERRCODE='42501';
  END IF;
  v_caller_project := public.get_user_project_id(v_caller);

  SELECT * INTO v_p FROM public.profiles WHERE user_id = p_user_id;
  IF v_p IS NULL THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE='P0002';
  END IF;

  -- Owners can view any; others must share the same project
  IF v_caller_role <> 'owner' AND v_caller_project IS NOT NULL AND v_p.project_id <> v_caller_project THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;

  SELECT role INTO v_role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;

  SELECT email, created_at, last_sign_in_at, banned_until
    INTO v_email, v_created, v_last_sign_in, v_banned_until
  FROM auth.users WHERE id = p_user_id;

  IF v_p.supervisor_id IS NOT NULL THEN
    SELECT full_name INTO v_sup_name FROM public.profiles WHERE user_id = v_p.supervisor_id;
  END IF;

  RETURN jsonb_build_object(
    'id', p_user_id,
    'email', COALESCE(v_email, ''),
    'fullName', COALESCE(v_p.full_name, ''),
    'phone', COALESCE(v_p.phone, ''),
    'avatarUrl', v_p.avatar_url,
    'employeeId', v_p.employee_id,
    'department', v_p.department,
    'status', COALESCE(v_p.status::text, 'active'),
    'role', v_role,
    'supervisorId', v_p.supervisor_id,
    'supervisorName', v_sup_name,
    'projectId', v_p.project_id,
    'joinDate', v_created,
    'lastSignIn', COALESCE(v_p.last_login_at, v_last_sign_in),
    'banned', (v_banned_until IS NOT NULL AND v_banned_until > now())
  );
END;
$$;

-- Team member stats
CREATE OR REPLACE FUNCTION public.get_team_member_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role app_role;
  v_caller_project uuid;
  v_target_project uuid;
  v_full_name text;
  v_total int;
  v_pending int;
  v_followups int;
  v_customers int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_caller_role FROM public.user_roles WHERE user_id = v_caller LIMIT 1;
  v_caller_project := public.get_user_project_id(v_caller);
  SELECT project_id, full_name INTO v_target_project, v_full_name FROM public.profiles WHERE user_id = p_user_id;
  IF v_caller_role <> 'owner' AND v_caller_project IS NOT NULL AND v_target_project IS DISTINCT FROM v_caller_project THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_total FROM public.orders WHERE assigned_to = p_user_id AND is_deleted = false;
  SELECT count(*) INTO v_pending FROM public.orders WHERE assigned_to = p_user_id AND is_deleted = false AND current_status = 'pending';
  SELECT count(*) INTO v_followups FROM public.followup_history WHERE completed_by = p_user_id;
  SELECT count(*) INTO v_customers FROM public.customers WHERE last_executive_name = COALESCE(v_full_name, '__none__');

  RETURN jsonb_build_object(
    'totalOrders', v_total,
    'pendingOrders', v_pending,
    'completedFollowups', v_followups,
    'assignedCustomers', v_customers
  );
END;
$$;

-- Team member activity (order activity + hierarchy + followups)
CREATE OR REPLACE FUNCTION public.get_team_member_activity(p_user_id uuid, p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role app_role;
  v_caller_project uuid;
  v_target_project uuid;
  v_lim int := LEAST(GREATEST(COALESCE(p_limit,100), 1), 300);
  v_order_activity jsonb;
  v_hierarchy jsonb;
  v_followups jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_caller_role FROM public.user_roles WHERE user_id = v_caller LIMIT 1;
  v_caller_project := public.get_user_project_id(v_caller);
  SELECT project_id INTO v_target_project FROM public.profiles WHERE user_id = p_user_id;
  IF v_caller_role <> 'owner' AND v_caller_project IS NOT NULL AND v_target_project IS DISTINCT FROM v_caller_project THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_order_activity FROM (
    SELECT id, order_id, action_type, action_description, user_name, created_at, project_id
    FROM public.order_activity_logs
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT v_lim
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_hierarchy FROM (
    SELECT id, change_type, old_value, new_value, actor_name, created_at, reason
    FROM public.hierarchy_audit_log
    WHERE target_user_id = p_user_id OR actor_user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 50
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_followups FROM (
    SELECT id, order_id, step_number, note, completed_at
    FROM public.followup_history
    WHERE completed_by = p_user_id
    ORDER BY completed_at DESC
    LIMIT v_lim
  ) x;

  RETURN jsonb_build_object(
    'orderActivity', v_order_activity,
    'hierarchy', v_hierarchy,
    'followups', v_followups
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_member_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_member_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_member_activity(uuid, int) TO authenticated;
