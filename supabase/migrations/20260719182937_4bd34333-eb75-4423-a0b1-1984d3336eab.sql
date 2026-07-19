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

  INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
  VALUES (v_project, p_user_id, v_actor, v_actor_name, 'team_member_delete', COALESCE(v_target_name, ''), 'removed_from_team_directory', p_reason);

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

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_team_member_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_team_member_profile(uuid, text) TO authenticated;