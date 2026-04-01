
-- followup_history INSERT: scope to user's project via order
DROP POLICY IF EXISTS "Admin/SubAdmin can insert followup history" ON public.followup_history;
CREATE POLICY "Authenticated can insert followup history" ON public.followup_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role))
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.project_id = get_user_project_id(auth.uid()))
  );

-- upsell_records INSERT: scope via followup -> order -> project
DROP POLICY IF EXISTS "Admin/SubAdmin/SE can insert upsell records" ON public.upsell_records;
CREATE POLICY "Authenticated can insert upsell records" ON public.upsell_records
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      JOIN public.orders o ON o.id = fh.order_id
      WHERE fh.id = followup_id AND o.project_id = get_user_project_id(auth.uid())
    )
  );

-- repeat_order_records INSERT: scope via followup -> order -> project
DROP POLICY IF EXISTS "Admin/SubAdmin/SE can insert repeat order records" ON public.repeat_order_records;
CREATE POLICY "Authenticated can insert repeat order records" ON public.repeat_order_records
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      JOIN public.orders o ON o.id = fh.order_id
      WHERE fh.id = followup_id AND o.project_id = get_user_project_id(auth.uid())
    )
  );

-- followup_problems INSERT: scope project_id
DROP POLICY IF EXISTS "Admin/SubAdmin can insert followup problems" ON public.followup_problems;
CREATE POLICY "Admin/SubAdmin can insert followup problems" ON public.followup_problems
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid()))
  );

-- followup_quick_info_fields INSERT: scope project_id
DROP POLICY IF EXISTS "Admin/SubAdmin can insert quick info fields" ON public.followup_quick_info_fields;
CREATE POLICY "Admin/SubAdmin can insert quick info fields" ON public.followup_quick_info_fields
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid()))
  );

-- profiles SELECT: scope admin view to own project
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view project profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND project_id = get_user_project_id(auth.uid())
  );
