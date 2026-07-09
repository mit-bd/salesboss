
-- 1. Sales Executive orders UPDATE policy: add project + permission guard, plus WITH CHECK
DROP POLICY IF EXISTS "Sales executive can update assigned orders" ON public.orders;
CREATE POLICY "Sales executive can update assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'sales_executive'::app_role)
  AND assigned_to = auth.uid()
  AND project_id = public.get_user_project_id(auth.uid())
  AND public.has_permission(auth.uid(), 'orders.edit')
)
WITH CHECK (
  public.has_role(auth.uid(), 'sales_executive'::app_role)
  AND assigned_to = auth.uid()
  AND project_id = public.get_user_project_id(auth.uid())
  AND public.has_permission(auth.uid(), 'orders.edit')
);

-- 2. Global permission catalog: ensure anon has no access, authenticated read only
REVOKE ALL ON public.permissions FROM PUBLIC, anon;
REVOKE ALL ON public.role_permissions FROM PUBLIC, anon;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
GRANT ALL ON public.role_permissions TO service_role;

-- 3. SECURITY DEFINER function hardening: remove PUBLIC/anon EXECUTE; grant to
--    the minimum required roles. Trigger-invoked functions (handle_new_user,
--    generate_sku_order_id, update_updated_at_column) run under the table owner
--    and do not need EXECUTE grants to end-user roles.

-- Helpers used by RLS policies and app queries
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_user_project_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_project_id(uuid) TO authenticated, service_role;

-- Customer helper used at order creation time
REVOKE ALL ON FUNCTION public.find_or_create_customer(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_customer(text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_next_sku_sequence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_sku_sequence(text) TO authenticated, service_role;

-- Bulk mutation RPCs (client-invoked)
REVOKE ALL ON FUNCTION public.bulk_update_orders(uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_orders(uuid[], jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.bulk_update_orders_with_lock(uuid[], jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_orders_with_lock(uuid[], jsonb, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.bulk_complete_followups(uuid[], integer, text, date, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_complete_followups(uuid[], integer, text, date, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.bulk_complete_followups_with_lock(uuid[], jsonb, integer, text, date, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_complete_followups_with_lock(uuid[], jsonb, integer, text, date, uuid, text) TO authenticated, service_role;

-- Automation-only functions: restrict to service_role (invoked by edge fn / cron)
REVOKE ALL ON FUNCTION public.advance_followup_steps() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_followup_steps() TO service_role;

REVOKE ALL ON FUNCTION public.run_followup_automation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_followup_automation() TO service_role;

REVOKE ALL ON FUNCTION public.prune_followup_automation_runs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_followup_automation_runs() TO service_role;

-- Trigger-only functions: no direct EXECUTE needed by client roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_sku_order_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 4. Indexes: user_roles has UNIQUE (user_id, role) — user_id is leftmost so
--    lookups by user_id are already indexed. profiles has UNIQUE (user_id).
--    No additional indexes required.
