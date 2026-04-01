
-- Fix customers: change from public/true to authenticated with project scoping
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (project_id = get_user_project_id(auth.uid()));

-- Fix followup_history: change from public/true to authenticated, scope via orders table
DROP POLICY IF EXISTS "Authenticated users can view followup history" ON public.followup_history;
CREATE POLICY "Authenticated users can view followup history" ON public.followup_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = followup_history.order_id
        AND o.project_id = get_user_project_id(auth.uid())
    )
  );

-- Fix upsell_records: change from public/true to authenticated, scope via followup_history -> orders
DROP POLICY IF EXISTS "Authenticated users can view upsell records" ON public.upsell_records;
CREATE POLICY "Authenticated users can view upsell records" ON public.upsell_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.followup_history fh
      JOIN public.orders o ON o.id = fh.order_id
      WHERE fh.id = upsell_records.followup_id
        AND o.project_id = get_user_project_id(auth.uid())
    )
  );

-- Fix repeat_order_records: same pattern
DROP POLICY IF EXISTS "Authenticated users can view repeat order records" ON public.repeat_order_records;
CREATE POLICY "Authenticated users can view repeat order records" ON public.repeat_order_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.followup_history fh
      JOIN public.orders o ON o.id = fh.order_id
      WHERE fh.id = repeat_order_records.followup_id
        AND o.project_id = get_user_project_id(auth.uid())
    )
  );

-- Also fix other public-role policies that should be authenticated:
-- customers INSERT
DROP POLICY IF EXISTS "Admin/SubAdmin/SE can insert customers" ON public.customers;
CREATE POLICY "Admin/SubAdmin/SE can insert customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role));

-- customers UPDATE
DROP POLICY IF EXISTS "Admin/SubAdmin can update customers" ON public.customers;
CREATE POLICY "Admin/SubAdmin can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- customers DELETE
DROP POLICY IF EXISTS "Admin can delete customers" ON public.customers;
CREATE POLICY "Admin can delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- followup_history INSERT
DROP POLICY IF EXISTS "Admin/SubAdmin can insert followup history" ON public.followup_history;
CREATE POLICY "Admin/SubAdmin can insert followup history" ON public.followup_history
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role));

-- followup_history UPDATE
DROP POLICY IF EXISTS "Admin/SubAdmin can update followup history" ON public.followup_history;
CREATE POLICY "Admin/SubAdmin can update followup history" ON public.followup_history
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- followup_history DELETE
DROP POLICY IF EXISTS "Admin can delete followup history" ON public.followup_history;
CREATE POLICY "Admin can delete followup history" ON public.followup_history
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- upsell_records INSERT
DROP POLICY IF EXISTS "Admin/SubAdmin/SE can insert upsell records" ON public.upsell_records;
CREATE POLICY "Admin/SubAdmin/SE can insert upsell records" ON public.upsell_records
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role));

-- upsell_records UPDATE
DROP POLICY IF EXISTS "Admin can update upsell records" ON public.upsell_records;
CREATE POLICY "Admin can update upsell records" ON public.upsell_records
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- upsell_records DELETE
DROP POLICY IF EXISTS "Admin can delete upsell records" ON public.upsell_records;
CREATE POLICY "Admin can delete upsell records" ON public.upsell_records
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- repeat_order_records INSERT
DROP POLICY IF EXISTS "Admin/SubAdmin/SE can insert repeat order records" ON public.repeat_order_records;
CREATE POLICY "Admin/SubAdmin/SE can insert repeat order records" ON public.repeat_order_records
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role));

-- repeat_order_records UPDATE
DROP POLICY IF EXISTS "Admin can update repeat order records" ON public.repeat_order_records;
CREATE POLICY "Admin can update repeat order records" ON public.repeat_order_records
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- repeat_order_records DELETE
DROP POLICY IF EXISTS "Admin can delete repeat order records" ON public.repeat_order_records;
CREATE POLICY "Admin can delete repeat order records" ON public.repeat_order_records
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
