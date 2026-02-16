
-- Permissions catalog table
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  category text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Role-permission junction table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission_key)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Permissions policies
CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions FOR SELECT USING (true);

CREATE POLICY "Admin can insert permissions"
  ON public.permissions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update permissions"
  ON public.permissions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete permissions"
  ON public.permissions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Role permissions policies
CREATE POLICY "Authenticated users can view role_permissions"
  ON public.role_permissions FOR SELECT USING (true);

CREATE POLICY "Admin can insert role_permissions"
  ON public.role_permissions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update role_permissions"
  ON public.role_permissions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete role_permissions"
  ON public.role_permissions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;

-- Seed all permission entries
INSERT INTO public.permissions (key, category, label) VALUES
  ('orders.view', 'Orders', 'View Orders'),
  ('orders.create', 'Orders', 'Create Order'),
  ('orders.edit', 'Orders', 'Edit Order'),
  ('orders.delete', 'Orders', 'Soft Delete Order'),
  ('orders.assign', 'Orders', 'Assign Order'),
  ('orders.bulk_assign', 'Orders', 'Bulk Assign'),
  ('orders.view_all', 'Orders', 'View All Orders'),
  ('orders.view_assigned', 'Orders', 'View Only Assigned Orders'),
  ('followups.view', 'Followups', 'View Followup'),
  ('followups.complete', 'Followups', 'Complete Followup'),
  ('followups.edit', 'Followups', 'Edit Followup'),
  ('followups.add_upsell', 'Followups', 'Add Upsell'),
  ('followups.add_repeat', 'Followups', 'Add Repeat Order'),
  ('products.view', 'Products', 'View Product'),
  ('products.create', 'Products', 'Add Product'),
  ('products.edit', 'Products', 'Edit Product'),
  ('products.toggle', 'Products', 'Activate/Deactivate Product'),
  ('delivery.view', 'Delivery Methods', 'View Delivery Method'),
  ('delivery.manage', 'Delivery Methods', 'Add/Edit Delivery Method'),
  ('sales.view_performance', 'Sales Executives', 'View Performance'),
  ('sales.view_all', 'Sales Executives', 'View All Executive Data'),
  ('sales.view_own', 'Sales Executives', 'View Only Own Performance'),
  ('commission.view', 'Commission', 'View Commission'),
  ('commission.edit', 'Commission', 'Edit Commission'),
  ('commission.mark_paid', 'Commission', 'Mark Commission Paid'),
  ('backup.view', 'Backup & Export', 'View Backup Center'),
  ('backup.trigger', 'Backup & Export', 'Trigger Backup'),
  ('backup.export', 'Backup & Export', 'Export Data'),
  ('audit.view', 'Audit Logs', 'View Audit Logs'),
  ('roles.manage', 'Roles', 'Manage Roles');

-- Seed Admin: all permissions
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'admin', key FROM public.permissions;

-- Seed Sub Admin: most permissions
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'sub_admin', key FROM public.permissions
WHERE key NOT IN ('roles.manage', 'backup.trigger', 'audit.view');

-- Seed Sales Executive: limited permissions
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('sales_executive', 'orders.view'),
  ('sales_executive', 'orders.create'),
  ('sales_executive', 'orders.view_assigned'),
  ('sales_executive', 'followups.view'),
  ('sales_executive', 'followups.complete'),
  ('sales_executive', 'followups.add_upsell'),
  ('sales_executive', 'followups.add_repeat'),
  ('sales_executive', 'products.view'),
  ('sales_executive', 'delivery.view'),
  ('sales_executive', 'sales.view_own'),
  ('sales_executive', 'commission.view');

-- DB function to check permission for current user
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role::text = rp.role
    WHERE ur.user_id = _user_id
      AND rp.permission_key = _permission
  )
$$;
