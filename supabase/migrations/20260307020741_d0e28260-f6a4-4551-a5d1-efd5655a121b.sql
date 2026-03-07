
-- Replace the overly permissive SELECT policy with role-based visibility
DROP POLICY "Authenticated users can view orders" ON public.orders;

-- Admin/Sub-Admin can see all orders
CREATE POLICY "Admin/SubAdmin can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'sub_admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
  );

-- Sales Executives can only see orders assigned to them
CREATE POLICY "SE can view assigned orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'sales_executive'::app_role) 
    AND assigned_to = auth.uid()
  );
