
-- ============================================================
-- Team Management: permissions + RPCs
-- ============================================================

-- Ensure permission catalog rows exist
INSERT INTO public.permissions (key, category, label) VALUES
  ('team.view',       'Team', 'View Team Members'),
  ('team.manage',     'Team', 'Manage Team Members (Edit/Role/Reset)'),
  ('team.hierarchy',  'Team', 'Change Supervisor / Hierarchy'),
  ('team.bulk',       'Team', 'Bulk Team Actions'),
  ('team.delete',     'Team', 'Delete Team Members'),
  ('team.status',     'Team', 'Change Employee Status (Hold/Suspend/Archive)')
ON CONFLICT (key) DO NOTHING;

-- Grant to admin by default (idempotent)
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'admin', k FROM (VALUES
  ('team.view'),('team.manage'),('team.hierarchy'),('team.bulk'),('team.delete'),('team.status')
) v(k)
ON CONFLICT DO NOTHING;

-- Sub-admin: view + hierarchy only
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'sub_admin', k FROM (VALUES ('team.view'),('team.hierarchy')) v(k)
ON CONFLICT DO NOTHING;

-- Manager & team_leader: view team
INSERT INTO public.role_permissions (role, permission_key)
SELECT r, 'team.view' FROM (VALUES ('manager'),('team_leader')) v(r)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Missing INSERT policy on hierarchy_audit_log for privileged users
-- (SELECT already exists; ensure INSERT exists so RPCs can log)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='hierarchy_audit_log'
      AND policyname='Privileged users can insert hierarchy audit'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Privileged users can insert hierarchy audit"
      ON public.hierarchy_audit_log FOR INSERT TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(),'owner'::app_role)
        OR public.has_role(auth.uid(),'admin'::app_role)
      )
    $p$;
  END IF;
END $$;

-- ------------------------------------------------------------
-- Guard: caller must be owner or admin of the target's project
CREATE OR REPLACE FUNCTION public._team_admin_guard(_target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_target_project uuid;
  v_caller_project uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT project_id INTO v_target_project FROM public.profiles WHERE user_id = _target_user_id;
  IF v_target_project IS NULL THEN
    RAISE EXCEPTION 'Target user not found or has no project' USING ERRCODE = 'P0002';
  END IF;

  IF public.has_role(v_caller, 'owner'::app_role) THEN
    RETURN v_target_project;
  END IF;

  IF NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin or Owner only' USING ERRCODE = '42501';
  END IF;

  v_caller_project := public.get_user_project_id(v_caller);
  IF v_caller_project IS NULL OR v_caller_project <> v_target_project THEN
    RAISE EXCEPTION 'Target user is not in your project' USING ERRCODE = '42501';
  END IF;

  RETURN v_target_project;
END;
$$;

-- ------------------------------------------------------------
-- set_employee_status
CREATE OR REPLACE FUNCTION public.set_employee_status(
  p_user_id uuid,
  p_status employee_status,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project uuid;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_old employee_status;
BEGIN
  v_project := public._team_admin_guard(p_user_id);
  SELECT status INTO v_old FROM public.profiles WHERE user_id = p_user_id;
  IF v_old = p_status THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;

  UPDATE public.profiles SET status = p_status, updated_at = now() WHERE user_id = p_user_id;

  SELECT COALESCE(full_name,'') INTO v_actor_name FROM public.profiles WHERE user_id = v_actor;
  INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
  VALUES (v_project, p_user_id, v_actor, v_actor_name, 'status', v_old::text, p_status::text, p_reason);

  RETURN jsonb_build_object('ok', true, 'old', v_old, 'new', p_status);
END; $$;

-- ------------------------------------------------------------
-- set_employee_supervisor
CREATE OR REPLACE FUNCTION public.set_employee_supervisor(
  p_user_id uuid,
  p_supervisor_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project uuid;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_old uuid;
  v_sup_project uuid;
BEGIN
  v_project := public._team_admin_guard(p_user_id);

  IF p_supervisor_id IS NOT NULL THEN
    IF p_supervisor_id = p_user_id THEN
      RAISE EXCEPTION 'A user cannot be their own supervisor' USING ERRCODE='22023';
    END IF;
    SELECT project_id INTO v_sup_project FROM public.profiles WHERE user_id = p_supervisor_id;
    IF v_sup_project IS NULL OR v_sup_project <> v_project THEN
      RAISE EXCEPTION 'Supervisor must belong to the same project' USING ERRCODE='22023';
    END IF;
    -- prevent cycles: supervisor must not already be in target's chain
    IF public.is_in_my_hierarchy(p_supervisor_id, p_user_id) THEN
      RAISE EXCEPTION 'Assignment would create a supervisor cycle' USING ERRCODE='22023';
    END IF;
  END IF;

  SELECT supervisor_id INTO v_old FROM public.profiles WHERE user_id = p_user_id;
  UPDATE public.profiles SET supervisor_id = p_supervisor_id, updated_at = now() WHERE user_id = p_user_id;

  SELECT COALESCE(full_name,'') INTO v_actor_name FROM public.profiles WHERE user_id = v_actor;
  INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
  VALUES (v_project, p_user_id, v_actor, v_actor_name, 'supervisor',
          COALESCE(v_old::text,''), COALESCE(p_supervisor_id::text,''), p_reason);

  RETURN jsonb_build_object('ok', true);
END; $$;

-- ------------------------------------------------------------
-- Bulk wrappers
CREATE OR REPLACE FUNCTION public.bulk_set_employee_status(
  p_user_ids uuid[],
  p_status employee_status,
  p_reason text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid; n int := 0;
BEGIN
  FOREACH u IN ARRAY p_user_ids LOOP
    BEGIN
      PERFORM public.set_employee_status(u, p_status, p_reason);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      -- skip individual failures, keep going
      NULL;
    END;
  END LOOP;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.bulk_set_employee_supervisor(
  p_user_ids uuid[],
  p_supervisor_id uuid,
  p_reason text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid; n int := 0;
BEGIN
  FOREACH u IN ARRAY p_user_ids LOOP
    BEGIN
      PERFORM public.set_employee_supervisor(u, p_supervisor_id, p_reason);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.bulk_set_user_role(
  p_user_ids uuid[],
  p_role app_role,
  p_reason text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u uuid; n int := 0;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_project uuid;
  v_old_role app_role;
BEGIN
  SELECT COALESCE(full_name,'') INTO v_actor_name FROM public.profiles WHERE user_id = v_actor;
  FOREACH u IN ARRAY p_user_ids LOOP
    BEGIN
      v_project := public._team_admin_guard(u);
      IF u = v_actor THEN CONTINUE; END IF;
      SELECT role INTO v_old_role FROM public.user_roles WHERE user_id = u;
      IF v_old_role IS NULL THEN
        INSERT INTO public.user_roles(user_id, role) VALUES (u, p_role);
      ELSE
        UPDATE public.user_roles SET role = p_role WHERE user_id = u;
      END IF;
      INSERT INTO public.hierarchy_audit_log(project_id, target_user_id, actor_user_id, actor_name, change_type, old_value, new_value, reason)
      VALUES (v_project, u, v_actor, v_actor_name, 'role', COALESCE(v_old_role::text,''), p_role::text, p_reason);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN n;
END; $$;

-- ------------------------------------------------------------
-- list_team_directory: enriched directory for the caller's project (admin/owner-safe)
CREATE OR REPLACE FUNCTION public.list_team_directory(p_project_id uuid DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  phone text,
  avatar_url text,
  employee_id text,
  department text,
  status employee_status,
  supervisor_id uuid,
  supervisor_name text,
  role app_role,
  project_id uuid,
  created_at timestamptz,
  last_login_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_project uuid;
BEGIN
  IF public.has_role(auth.uid(),'owner'::app_role) THEN
    v_project := p_project_id; -- owner may filter or view all
  ELSE
    v_project := public.get_user_project_id(auth.uid());
    IF v_project IS NULL THEN RETURN; END IF;
  END IF;

  RETURN QUERY
    SELECT p.user_id, p.full_name, p.phone, p.avatar_url, p.employee_id, p.department,
           p.status, p.supervisor_id,
           sup.full_name AS supervisor_name,
           ur.role, p.project_id, p.created_at, p.last_login_at
      FROM public.profiles p
      LEFT JOIN public.profiles sup ON sup.user_id = p.supervisor_id
      LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
     WHERE (v_project IS NULL OR p.project_id = v_project)
       AND COALESCE(ur.role,'sales_executive') <> 'owner';
END; $$;

GRANT EXECUTE ON FUNCTION public.set_employee_status(uuid, employee_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_employee_supervisor(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_set_employee_status(uuid[], employee_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_set_employee_supervisor(uuid[], uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_set_user_role(uuid[], app_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_team_directory(uuid) TO authenticated;
