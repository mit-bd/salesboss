-- ============================================================
-- Team write-path hardening: database RPCs for non-auth writes
-- ============================================================

CREATE OR REPLACE FUNCTION public._team_actor_name(_actor uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(full_name, '') FROM public.profiles WHERE user_id = _actor LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.toggle_team_member_voice(
  p_user_id uuid,
  p_enabled boolean,
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
  v_old boolean;
BEGIN
  IF p_user_id = v_actor THEN
    v_project := public.get_user_project_id(v_actor);
    IF v_project IS NULL THEN
      RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_project := public._team_admin_guard(p_user_id);
  END IF;

  SELECT COALESCE(ai_voice_enabled, false) INTO v_old
  FROM public.profiles
  WHERE user_id = p_user_id;

  UPDATE public.profiles
     SET ai_voice_enabled = COALESCE(p_enabled, false),
         updated_at = now()
   WHERE user_id = p_user_id;

  SELECT public._team_actor_name(v_actor) INTO v_actor_name;
  INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
  VALUES (v_project, p_user_id, v_actor, v_actor_name, 'voice', COALESCE(v_old::text, 'false'), COALESCE(p_enabled, false)::text, p_reason);

  RETURN jsonb_build_object('ok', true, 'old', COALESCE(v_old, false), 'new', COALESCE(p_enabled, false));
END;
$$;

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
BEGIN
  v_project := public._team_admin_guard(p_user_id);
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

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_team_member_profile(
  p_user_id uuid,
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
  v_target_name text;
BEGIN
  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'Cannot delete yourself' USING ERRCODE = '42501';
  END IF;

  v_project := public._team_admin_guard(p_user_id);
  SELECT public._team_actor_name(v_actor) INTO v_actor_name;
  SELECT COALESCE(full_name, '') INTO v_target_name FROM public.profiles WHERE user_id = p_user_id;

  UPDATE public.orders
     SET assigned_to = NULL,
         assigned_to_name = '',
         updated_at = now()
   WHERE assigned_to = p_user_id;

  UPDATE public.profiles
     SET supervisor_id = NULL,
         updated_at = now()
   WHERE supervisor_id = p_user_id;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE user_id = p_user_id;

  INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
  VALUES (v_project, p_user_id, v_actor, v_actor_name, 'team_member_delete', COALESCE(v_target_name, ''), 'removed_from_team_directory', p_reason);

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_remove_team_member_profiles(
  p_user_ids uuid[],
  p_reason text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u uuid;
  n integer := 0;
  v_actor uuid := auth.uid();
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH u IN ARRAY p_user_ids LOOP
    BEGIN
      IF u IS NULL OR u = v_actor THEN
        CONTINUE;
      END IF;
      PERFORM public.remove_team_member_profile(u, p_reason);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_team_member_voice(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_team_member_profile(uuid, text, text, text, text, app_role, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_team_member_profile(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_remove_team_member_profiles(uuid[], text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.toggle_team_member_voice(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member_profile(uuid, text, text, text, text, app_role, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_remove_team_member_profiles(uuid[], text) TO authenticated;