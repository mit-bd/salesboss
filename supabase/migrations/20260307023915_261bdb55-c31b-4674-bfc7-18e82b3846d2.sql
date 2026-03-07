
CREATE TABLE public.order_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id),
  user_id uuid,
  user_name text NOT NULL DEFAULT '',
  action_type text NOT NULL DEFAULT '',
  action_description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their project
CREATE POLICY "Users can view project activity logs"
  ON public.order_activity_logs
  FOR SELECT
  USING (project_id = get_user_project_id(auth.uid()));

-- Admins/SubAdmins/SE can insert logs
CREATE POLICY "Authenticated users can insert activity logs"
  ON public.order_activity_logs
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'sub_admin'::app_role) OR
    has_role(auth.uid(), 'sales_executive'::app_role)
  );

-- Index for fast lookups
CREATE INDEX idx_activity_logs_order_id ON public.order_activity_logs(order_id);
CREATE INDEX idx_activity_logs_project_id ON public.order_activity_logs(project_id);
