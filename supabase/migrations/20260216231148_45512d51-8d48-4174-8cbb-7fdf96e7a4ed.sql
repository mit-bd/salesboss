
-- upsell_records table
CREATE TABLE public.upsell_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  followup_id UUID NOT NULL REFERENCES public.followup_history(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view upsell records"
ON public.upsell_records FOR SELECT
USING (true);

CREATE POLICY "Admin/SubAdmin/SE can insert upsell records"
ON public.upsell_records FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sub_admin'::app_role)
  OR has_role(auth.uid(), 'sales_executive'::app_role)
);

CREATE POLICY "Admin can update upsell records"
ON public.upsell_records FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete upsell records"
ON public.upsell_records FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- repeat_order_records table
CREATE TABLE public.repeat_order_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  followup_id UUID NOT NULL REFERENCES public.followup_history(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  child_order_id UUID REFERENCES public.orders(id),
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repeat_order_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view repeat order records"
ON public.repeat_order_records FOR SELECT
USING (true);

CREATE POLICY "Admin/SubAdmin/SE can insert repeat order records"
ON public.repeat_order_records FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sub_admin'::app_role)
  OR has_role(auth.uid(), 'sales_executive'::app_role)
);

CREATE POLICY "Admin can update repeat order records"
ON public.repeat_order_records FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete repeat order records"
ON public.repeat_order_records FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add edited_by and edited_at to followup_history for admin edit tracking
ALTER TABLE public.followup_history
ADD COLUMN edited_by UUID,
ADD COLUMN edited_at TIMESTAMPTZ;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.upsell_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.repeat_order_records;
