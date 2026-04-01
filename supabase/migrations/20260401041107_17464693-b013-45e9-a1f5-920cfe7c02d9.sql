
-- ==========================================
-- Fix INSERT policies with project scoping
-- ==========================================

-- orders INSERT
DROP POLICY IF EXISTS "Admin can insert orders" ON public.orders;
CREATE POLICY "Authenticated can insert orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role))
    AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid()))
  );

-- customers INSERT
DROP POLICY IF EXISTS "Admin/SubAdmin/SE can insert customers" ON public.customers;
CREATE POLICY "Authenticated can insert customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role) OR has_role(auth.uid(), 'sales_executive'::app_role))
    AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid()))
  );

-- delivery_methods INSERT
DROP POLICY IF EXISTS "Admin/SubAdmin can insert delivery methods" ON public.delivery_methods;
CREATE POLICY "Admin/SubAdmin can insert delivery methods" ON public.delivery_methods
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid()))
  );

-- products INSERT
DROP POLICY IF EXISTS "Admin/SubAdmin can insert products" ON public.products;
CREATE POLICY "Admin/SubAdmin can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid()))
  );

-- order_sources INSERT
DROP POLICY IF EXISTS "Admin/SubAdmin can insert order sources" ON public.order_sources;
CREATE POLICY "Admin/SubAdmin can insert order sources" ON public.order_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND (project_id IS NULL OR project_id = get_user_project_id(auth.uid()))
  );

-- ==========================================
-- Fix UPDATE policies with project scoping
-- ==========================================

-- orders UPDATE (admin/sub_admin)
DROP POLICY IF EXISTS "Admin/SubAdmin can update any order" ON public.orders;
CREATE POLICY "Admin/SubAdmin can update project orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND project_id = get_user_project_id(auth.uid())
  );

-- customers UPDATE
DROP POLICY IF EXISTS "Admin/SubAdmin can update customers" ON public.customers;
CREATE POLICY "Admin/SubAdmin can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND project_id = get_user_project_id(auth.uid())
  );

-- orders DELETE (also scope to project)
DROP POLICY IF EXISTS "Admin can delete orders" ON public.orders;
CREATE POLICY "Admin can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));

-- delivery_methods UPDATE (scope to project)
DROP POLICY IF EXISTS "Admin/SubAdmin can update delivery methods" ON public.delivery_methods;
CREATE POLICY "Admin/SubAdmin can update delivery methods" ON public.delivery_methods
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND project_id = get_user_project_id(auth.uid())
  );

-- delivery_methods DELETE (scope to project)
DROP POLICY IF EXISTS "Admin can delete delivery methods" ON public.delivery_methods;
CREATE POLICY "Admin can delete delivery methods" ON public.delivery_methods
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));

-- order_sources UPDATE (scope to project)
DROP POLICY IF EXISTS "Admin/SubAdmin can update order sources" ON public.order_sources;
CREATE POLICY "Admin/SubAdmin can update order sources" ON public.order_sources
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND project_id = get_user_project_id(auth.uid())
  );

-- order_sources DELETE (scope to project)
DROP POLICY IF EXISTS "Admin can delete order sources" ON public.order_sources;
CREATE POLICY "Admin can delete order sources" ON public.order_sources
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_system = false AND project_id = get_user_project_id(auth.uid()));

-- products UPDATE (scope to project)
DROP POLICY IF EXISTS "Admin/SubAdmin can update products" ON public.products;
CREATE POLICY "Admin/SubAdmin can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role))
    AND project_id = get_user_project_id(auth.uid())
  );

-- products DELETE (scope to project)
DROP POLICY IF EXISTS "Admin can delete products" ON public.products;
CREATE POLICY "Admin can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND project_id = get_user_project_id(auth.uid()));
