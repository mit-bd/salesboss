
-- ==========================================
-- 1. Fix cross-project SELECT exposure
-- ==========================================

-- order_sources
DROP POLICY IF EXISTS "Authenticated users can view order sources" ON public.order_sources;
CREATE POLICY "Authenticated users can view order sources" ON public.order_sources
  FOR SELECT TO authenticated
  USING (project_id = get_user_project_id(auth.uid()));

-- delivery_methods
DROP POLICY IF EXISTS "Authenticated users can view delivery methods" ON public.delivery_methods;
CREATE POLICY "Authenticated users can view delivery methods" ON public.delivery_methods
  FOR SELECT TO authenticated
  USING (project_id = get_user_project_id(auth.uid()));

-- followup_problems
DROP POLICY IF EXISTS "Authenticated users can view followup problems" ON public.followup_problems;
CREATE POLICY "Authenticated users can view followup problems" ON public.followup_problems
  FOR SELECT TO authenticated
  USING (project_id = get_user_project_id(auth.uid()));

-- followup_quick_info_fields
DROP POLICY IF EXISTS "Authenticated users can view quick info fields" ON public.followup_quick_info_fields;
CREATE POLICY "Authenticated users can view quick info fields" ON public.followup_quick_info_fields
  FOR SELECT TO authenticated
  USING (project_id = get_user_project_id(auth.uid()));

-- products
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Authenticated users can view products" ON public.products
  FOR SELECT TO authenticated
  USING (project_id = get_user_project_id(auth.uid()));

-- ==========================================
-- 2. Convert public→authenticated on write policies
-- ==========================================

-- delivery_methods
DROP POLICY IF EXISTS "Admin can delete delivery methods" ON public.delivery_methods;
CREATE POLICY "Admin can delete delivery methods" ON public.delivery_methods
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin/SubAdmin can insert delivery methods" ON public.delivery_methods;
CREATE POLICY "Admin/SubAdmin can insert delivery methods" ON public.delivery_methods
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

DROP POLICY IF EXISTS "Admin/SubAdmin can update delivery methods" ON public.delivery_methods;
CREATE POLICY "Admin/SubAdmin can update delivery methods" ON public.delivery_methods
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- order_sources
DROP POLICY IF EXISTS "Admin can delete order sources" ON public.order_sources;
CREATE POLICY "Admin can delete order sources" ON public.order_sources
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND is_system = false);

DROP POLICY IF EXISTS "Admin/SubAdmin can insert order sources" ON public.order_sources;
CREATE POLICY "Admin/SubAdmin can insert order sources" ON public.order_sources
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

DROP POLICY IF EXISTS "Admin/SubAdmin can update order sources" ON public.order_sources;
CREATE POLICY "Admin/SubAdmin can update order sources" ON public.order_sources
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- orders
DROP POLICY IF EXISTS "Admin can delete orders" ON public.orders;
CREATE POLICY "Admin can delete orders" ON public.orders
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can insert orders" ON public.orders;
CREATE POLICY "Admin can insert orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role));

DROP POLICY IF EXISTS "Admin/SubAdmin can update any order" ON public.orders;
CREATE POLICY "Admin/SubAdmin can update any order" ON public.orders
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

DROP POLICY IF EXISTS "Sales executive can update assigned orders" ON public.orders;
CREATE POLICY "Sales executive can update assigned orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'sales_executive'::app_role) AND assigned_to = auth.uid());

-- order_activity_logs
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.order_activity_logs;
CREATE POLICY "Authenticated users can insert activity logs" ON public.order_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role));

DROP POLICY IF EXISTS "Users can view project activity logs" ON public.order_activity_logs;
CREATE POLICY "Users can view project activity logs" ON public.order_activity_logs
  FOR SELECT TO authenticated
  USING (project_id = get_user_project_id(auth.uid()));

-- permissions
DROP POLICY IF EXISTS "Admin can delete permissions" ON public.permissions;
CREATE POLICY "Admin can delete permissions" ON public.permissions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can insert permissions" ON public.permissions;
CREATE POLICY "Admin can insert permissions" ON public.permissions
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can update permissions" ON public.permissions;
CREATE POLICY "Admin can update permissions" ON public.permissions
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;
CREATE POLICY "Authenticated users can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

-- role_permissions
DROP POLICY IF EXISTS "Admin can delete role_permissions" ON public.role_permissions;
CREATE POLICY "Admin can delete role_permissions" ON public.role_permissions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can insert role_permissions" ON public.role_permissions;
CREATE POLICY "Admin can insert role_permissions" ON public.role_permissions
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can update role_permissions" ON public.role_permissions;
CREATE POLICY "Admin can update role_permissions" ON public.role_permissions
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users can view role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
