
-- order_activity_logs INSERT: scope project_id
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.order_activity_logs;
CREATE POLICY "Authenticated users can insert activity logs" ON public.order_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role))
    AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid()))
  );

-- user_roles INSERT: prevent assigning admin/owner roles
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND role IN ('sub_admin'::app_role, 'sales_executive'::app_role)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = user_roles.user_id AND p.project_id = get_user_project_id(auth.uid()))
  );
