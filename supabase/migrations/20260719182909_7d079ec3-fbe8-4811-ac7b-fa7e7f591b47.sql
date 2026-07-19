CREATE OR REPLACE FUNCTION public.update_team_member_profile(
  p_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_employee_id text DEFAULT NULL,
  p_role app_role DEFAULT NULL,
  p_supervisor_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_old_name text;
  v_old_phone text;
  v_old_department text;
  v_old_employee_id text;
  v_old_role app_role;
  v_old_supervisor uuid;
  v_existing_project uuid;
  v_caller_project uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT project_id INTO v_existing_project
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_existing_project IS NULL THEN
    IF p_user_id = v_actor THEN
      RAISE EXCEPTION 'Cannot initialize your own team profile' USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_role(v_actor, 'admin'::app_role) OR public.has_role(v_actor, 'owner'::app_role)) THEN
      RAISE EXCEPTION 'Admin or Owner only' USING ERRCODE = '42501';
    END IF;

    v_caller_project := public.get_user_project_id(v_actor);
    IF v_caller_project IS NULL THEN
      RAISE EXCEPTION 'Caller has no project' USING ERRCODE = '42501';
    END IF;

    v_project := v_caller_project;
    UPDATE public.profiles
       SET project_id = v_project,
           updated_at = now()
     WHERE user_id = p_user_id;
  ELSE
    v_project := public._team_admin_guard(p_user_id);
  END IF;

  IF p_user_id = v_actor AND p_role IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot change your own role' USING ERRCODE = '42501';
  END IF;

  SELECT full_name, phone, department, employee_id, supervisor_id
    INTO v_old_name, v_old_phone, v_old_department, v_old_employee_id, v_old_supervisor
  FROM public.profiles
  WHERE user_id = p_user_id;

  SELECT role INTO v_old_role FROM public.user_roles WHERE user_id = p_user_id;

  UPDATE public.profiles
     SET full_name = CASE WHEN p_full_name IS NULL THEN full_name ELSE p_full_name END,
         phone = CASE WHEN p_phone IS NULL THEN phone ELSE p_phone END,
         department = CASE WHEN p_department IS NULL THEN department ELSE p_department END,
         employee_id = CASE WHEN p_employee_id IS NULL THEN employee_id ELSE NULLIF(p_employee_id, '') END,
         updated_at = now()
   WHERE user_id = p_user_id;

  SELECT public._team_actor_name(v_actor) INTO v_actor_name;

  IF v_existing_project IS NULL THEN
    INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
    VALUES (v_project, p_user_id, v_actor, v_actor_name, 'project_assignment', '', v_project::text, p_reason);
  END IF;

  IF p_full_name IS NOT NULL AND COALESCE(v_old_name, '') IS DISTINCT FROM COALESCE(p_full_name, '') THEN
    INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
    VALUES (v_project, p_user_id, v_actor, v_actor_name, 'profile_name', COALESCE(v_old_name, ''), COALESCE(p_full_name, ''), p_reason);
  END IF;

  IF p_phone IS NOT NULL AND COALESCE(v_old_phone, '') IS DISTINCT FROM COALESCE(p_phone, '') THEN
    INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
    VALUES (v_project, p_user_id, v_actor, v_actor_name, 'profile_phone', COALESCE(v_old_phone, ''), COALESCE(p_phone, ''), p_reason);
  END IF;

  IF p_department IS NOT NULL AND COALESCE(v_old_department, '') IS DISTINCT FROM COALESCE(p_department, '') THEN
    INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
    VALUES (v_project, p_user_id, v_actor, v_actor_name, 'profile_department', COALESCE(v_old_department, ''), COALESCE(p_department, ''), p_reason);
  END IF;

  IF p_employee_id IS NOT NULL AND COALESCE(v_old_employee_id, '') IS DISTINCT FROM COALESCE(NULLIF(p_employee_id, ''), '') THEN
    INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
    VALUES (v_project, p_user_id, v_actor, v_actor_name, 'employee_id', COALESCE(v_old_employee_id, ''), COALESCE(NULLIF(p_employee_id, ''), ''), p_reason);
  END IF;

  IF p_role IS NOT NULL AND v_old_role IS DISTINCT FROM p_role THEN
    IF v_old_role IS NULL THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (p_user_id, p_role);
    ELSE
      UPDATE public.user_roles SET role = p_role WHERE user_id = p_user_id;
    END IF;
    INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
    VALUES (v_project, p_user_id, v_actor, v_actor_name, 'role', COALESCE(v_old_role::text, ''), p_role::text, p_reason);
  END IF;

  IF p_supervisor_id IS DISTINCT FROM v_old_supervisor THEN
    PERFORM public.set_employee_supervisor(p_user_id, p_supervisor_id, p_reason);
  END IF;

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'project_id', v_project);
END;
$$;

REVOKE ALL ON FUNCTION public.update_team_member_profile(uuid, text, text, text, text, app_role, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_team_member_profile(uuid, text, text, text, text, app_role, uuid, text) TO authenticated;