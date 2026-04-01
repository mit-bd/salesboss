
-- ==========================================
-- Orders SELECT: add project scoping for admin/sub_admin
-- ==========================================
DROP POLICY IF EXISTS "Admin/SubAdmin can view all orders" ON public.orders;
CREATE POLICY "Admin/SubAdmin can view project orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND (has_role(auth.uid(), 'owner'::app_role) OR project_id = get_user_project_id(auth.uid()))
  );

-- ==========================================
-- Customers DELETE: scope to project
-- ==========================================
DROP POLICY IF EXISTS "Admin can delete customers" ON public.customers;
CREATE POLICY "Admin can delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));

-- ==========================================
-- Commission configs: replace ALL with project-scoped
-- ==========================================
DROP POLICY IF EXISTS "Admin can do all on commission_configs" ON public.commission_configs;
CREATE POLICY "Admin can select commission_configs" ON public.commission_configs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));
CREATE POLICY "Admin can insert commission_configs" ON public.commission_configs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid())));
CREATE POLICY "Admin can update commission_configs" ON public.commission_configs
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));
CREATE POLICY "Admin can delete commission_configs" ON public.commission_configs
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));

-- ==========================================
-- Commission entries: replace ALL with project-scoped
-- ==========================================
DROP POLICY IF EXISTS "Admin can do all on commission_entries" ON public.commission_entries;
CREATE POLICY "Admin can select commission_entries" ON public.commission_entries
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));
CREATE POLICY "Admin can insert commission_entries" ON public.commission_entries
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid())));
CREATE POLICY "Admin can update commission_entries" ON public.commission_entries
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));
CREATE POLICY "Admin can delete commission_entries" ON public.commission_entries
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));

-- ==========================================
-- Sales targets: replace ALL with project-scoped
-- ==========================================
DROP POLICY IF EXISTS "Admin can do all on sales_targets" ON public.sales_targets;
CREATE POLICY "Admin can select sales_targets" ON public.sales_targets
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));
CREATE POLICY "Admin can insert sales_targets" ON public.sales_targets
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid())));
CREATE POLICY "Admin can update sales_targets" ON public.sales_targets
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));
CREATE POLICY "Admin can delete sales_targets" ON public.sales_targets
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));

-- ==========================================
-- Followup history: scope DELETE/UPDATE to project
-- ==========================================
DROP POLICY IF EXISTS "Admin can delete followup history" ON public.followup_history;
CREATE POLICY "Admin can delete followup history" ON public.followup_history
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = followup_history.order_id AND o.project_id = get_user_project_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin/SubAdmin can update followup history" ON public.followup_history;
CREATE POLICY "Admin/SubAdmin can update followup history" ON public.followup_history
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = followup_history.order_id AND o.project_id = get_user_project_id(auth.uid()))
  );

-- ==========================================
-- Upsell records: scope DELETE/UPDATE to project
-- ==========================================
DROP POLICY IF EXISTS "Admin can delete upsell records" ON public.upsell_records;
CREATE POLICY "Admin can delete upsell records" ON public.upsell_records
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      JOIN public.orders o ON o.id = fh.order_id
      WHERE fh.id = upsell_records.followup_id AND o.project_id = get_user_project_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admin can update upsell records" ON public.upsell_records;
CREATE POLICY "Admin can update upsell records" ON public.upsell_records
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      JOIN public.orders o ON o.id = fh.order_id
      WHERE fh.id = upsell_records.followup_id AND o.project_id = get_user_project_id(auth.uid())
    )
  );

-- ==========================================
-- Repeat order records: scope DELETE/UPDATE to project
-- ==========================================
DROP POLICY IF EXISTS "Admin can delete repeat order records" ON public.repeat_order_records;
CREATE POLICY "Admin can delete repeat order records" ON public.repeat_order_records
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      JOIN public.orders o ON o.id = fh.order_id
      WHERE fh.id = repeat_order_records.followup_id AND o.project_id = get_user_project_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admin can update repeat order records" ON public.repeat_order_records;
CREATE POLICY "Admin can update repeat order records" ON public.repeat_order_records
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      JOIN public.orders o ON o.id = fh.order_id
      WHERE fh.id = repeat_order_records.followup_id AND o.project_id = get_user_project_id(auth.uid())
    )
  );

-- ==========================================
-- User roles: scope admin writes to same-project users
-- ==========================================
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = user_roles.user_id AND p.project_id = get_user_project_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = user_roles.user_id AND p.project_id = get_user_project_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = user_roles.user_id AND p.project_id = get_user_project_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = user_roles.user_id AND p.project_id = get_user_project_id(auth.uid()))
  );

-- ==========================================
-- Followup problems/quick info: scope DELETE to project
-- ==========================================
DROP POLICY IF EXISTS "Admin can delete followup problems" ON public.followup_problems;
CREATE POLICY "Admin can delete followup problems" ON public.followup_problems
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));

DROP POLICY IF EXISTS "Admin can delete quick info fields" ON public.followup_quick_info_fields;
CREATE POLICY "Admin can delete quick info fields" ON public.followup_quick_info_fields
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));

-- Also scope UPDATE on followup_problems and quick_info_fields
DROP POLICY IF EXISTS "Admin/SubAdmin can update followup problems" ON public.followup_problems;
CREATE POLICY "Admin/SubAdmin can update followup problems" ON public.followup_problems
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND project_id = get_user_project_id(auth.uid())
  );

DROP POLICY IF EXISTS "Admin/SubAdmin can update quick info fields" ON public.followup_quick_info_fields;
CREATE POLICY "Admin/SubAdmin can update quick info fields" ON public.followup_quick_info_fields
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND project_id = get_user_project_id(auth.uid())
  );
