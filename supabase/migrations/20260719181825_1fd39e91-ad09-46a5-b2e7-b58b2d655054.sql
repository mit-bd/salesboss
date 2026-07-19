CREATE OR REPLACE FUNCTION public.list_team_members_full()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  role app_role,
  created_at timestamptz,
  last_sign_in timestamptz,
  email_confirmed boolean,
  banned boolean,
  ai_voice_enabled boolean,
  avatar_url text,
  employee_id text,
  department text,
  status public.employee_status,
  supervisor_id uuid,
  supervisor_name text,
  join_date timestamptz,
  project_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role app_role;
  v_project uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT ur.role INTO v_role FROM public.user_roles ur WHERE ur.user_id = v_caller LIMIT 1;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No role assigned' USING ERRCODE = '42501';
  END IF;

  v_project := public.get_user_project_id(v_caller);

  RETURN QUERY
  SELECT
    u.id,
    u.email::text AS email,
    p.full_name,
    p.phone,
    ur.role,
    u.created_at,
    u.last_sign_in_at AS last_sign_in,
    (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
    (u.banned_until IS NOT NULL AND u.banned_until > now()) AS banned,
    COALESCE(p.ai_voice_enabled, true) AS ai_voice_enabled,
    p.avatar_url,
    p.employee_id,
    p.department,
    p.status,
    p.supervisor_id,
    sp.full_name AS supervisor_name,
    u.created_at AS join_date,
    p.project_id
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.profiles sp ON sp.user_id = p.supervisor_id
  WHERE ur.role <> 'owner'
    AND (
      v_role = 'owner'
      OR (v_project IS NOT NULL AND p.project_id = v_project)
    )
  ORDER BY p.full_name NULLS LAST, u.email;
END;
$$;

REVOKE ALL ON FUNCTION public.list_team_members_full() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_team_members_full() TO authenticated;