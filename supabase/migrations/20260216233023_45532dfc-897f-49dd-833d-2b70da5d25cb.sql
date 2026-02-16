
-- Create delivery_methods table
CREATE TABLE public.delivery_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_info TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.delivery_methods ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view delivery methods"
ON public.delivery_methods FOR SELECT
USING (true);

CREATE POLICY "Admin/SubAdmin can insert delivery methods"
ON public.delivery_methods FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin/SubAdmin can update delivery methods"
ON public.delivery_methods FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin can delete delivery methods"
ON public.delivery_methods FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_methods;

-- Seed initial data from mock
INSERT INTO public.delivery_methods (name, contact_info, notes, is_active) VALUES
  ('Sundarban Courier', '01711-000001', 'Nationwide coverage', true),
  ('SA Paribahan', '01711-000002', 'Dhaka metro only', true),
  ('Pathao Courier', '01711-000003', 'Express delivery', true),
  ('RedX', '01711-000004', '', true),
  ('Paperfly', '01711-000005', 'Fragile items specialist', false);
