
-- Employee status enum
DO $$ BEGIN
  CREATE TYPE public.employee_status AS ENUM ('active','on_hold','suspended','resigned','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend profiles (all nullable / defaulted)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS status public.employee_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS supervisor_id uuid,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_supervisor_id ON public.profiles(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Auto-generate employee_id
CREATE SEQUENCE IF NOT EXISTS public.employee_id_seq START 1001;

CREATE OR REPLACE FUNCTION public.assign_employee_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN
    NEW.employee_id := 'EMP-' || lpad(nextval('public.employee_id_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_assign_employee_id ON public.profiles;
CREATE TRIGGER trg_profiles_assign_employee_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_employee_id();

-- Backfill existing rows
UPDATE public.profiles
   SET employee_id = 'EMP-' || lpad(nextval('public.employee_id_seq')::text, 5, '0')
 WHERE employee_id IS NULL;

-- Hierarchy audit log
CREATE TABLE IF NOT EXISTS public.hierarchy_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  target_user_id uuid NOT NULL,
  actor_user_id uuid,
  actor_name text,
  change_type text NOT NULL,
  old_value text,
  new_value text,
  reason text,
  bd_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Dhaka')::date),
  bd_time time NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Dhaka')::time),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.hierarchy_audit_log TO authenticated;
GRANT ALL ON public.hierarchy_audit_log TO service_role;

ALTER TABLE public.hierarchy_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and admins can read hierarchy audit" ON public.hierarchy_audit_log;
CREATE POLICY "Owners and admins can read hierarchy audit"
  ON public.hierarchy_audit_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'owner'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role)
  );

DROP POLICY IF EXISTS "Privileged users can insert hierarchy audit" ON public.hierarchy_audit_log;
CREATE POLICY "Privileged users can insert hierarchy audit"
  ON public.hierarchy_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'owner'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_hierarchy_audit_target ON public.hierarchy_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_audit_project ON public.hierarchy_audit_log(project_id);

-- Recursive supervisor-chain helper (used by future RLS OR-branches)
CREATE OR REPLACE FUNCTION public.is_in_my_hierarchy(_target_user_id uuid, _supervisor_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT user_id, supervisor_id
      FROM public.profiles
     WHERE user_id = _target_user_id
    UNION ALL
    SELECT p.user_id, p.supervisor_id
      FROM public.profiles p
      JOIN chain c ON c.supervisor_id = p.user_id
  )
  SELECT EXISTS (SELECT 1 FROM chain WHERE supervisor_id = _supervisor_user_id);
$$;

REVOKE EXECUTE ON FUNCTION public.is_in_my_hierarchy(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_in_my_hierarchy(uuid, uuid) TO authenticated, service_role;

-- Seed default permissions for the two new roles
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'team_leader', permission_key
  FROM public.role_permissions
 WHERE role = 'sales_executive'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'manager', permission_key
  FROM public.role_permissions
 WHERE role = 'sub_admin'
ON CONFLICT DO NOTHING;
