
-- Tighten INSERT policy: only admin/sub_admin can create notifications for others
DROP POLICY "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Admin/SubAdmin/SE can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'sub_admin'::app_role)
    OR has_role(auth.uid(), 'sales_executive'::app_role)
    OR user_id = auth.uid()
  );
