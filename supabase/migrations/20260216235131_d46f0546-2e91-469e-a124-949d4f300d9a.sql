
-- Create order_sources table
CREATE TABLE public.order_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_sources ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Authenticated users can view order sources"
  ON public.order_sources FOR SELECT
  USING (true);

-- Admin/SubAdmin can insert
CREATE POLICY "Admin/SubAdmin can insert order sources"
  ON public.order_sources FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- Admin/SubAdmin can update
CREATE POLICY "Admin/SubAdmin can update order sources"
  ON public.order_sources FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- Only admin can delete non-system sources
CREATE POLICY "Admin can delete order sources"
  ON public.order_sources FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_system = false);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_sources;

-- Seed default sources
INSERT INTO public.order_sources (name, is_system) VALUES
  ('Website', true),
  ('Phone Call', true),
  ('Referral', true),
  ('Messenger', true),
  ('WhatsApp', true),
  ('Comment', true),
  ('FB Group', true),
  ('Followup', true),
  ('SMS', true),
  ('Failed Order', true),
  ('Other', true);
