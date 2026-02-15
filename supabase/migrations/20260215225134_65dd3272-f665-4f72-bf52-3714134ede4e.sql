
-- Create orders table
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id text NOT NULL DEFAULT ('ORD-' || lpad(floor(random() * 100000)::text, 5, '0')),
  customer_name text NOT NULL,
  mobile text NOT NULL,
  address text NOT NULL DEFAULT '',
  order_source text NOT NULL DEFAULT 'Website',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_title text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  followup_step integer NOT NULL DEFAULT 1,
  followup_date date,
  assigned_to uuid,
  assigned_to_name text NOT NULL DEFAULT '',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date date,
  delivery_method text NOT NULL DEFAULT '',
  parent_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  is_repeat boolean NOT NULL DEFAULT false,
  is_upsell boolean NOT NULL DEFAULT false,
  health text NOT NULL DEFAULT 'new',
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_amount numeric NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies: All authenticated users can view orders
CREATE POLICY "Authenticated users can view orders"
  ON public.orders FOR SELECT
  USING (true);

-- Admin can do everything
CREATE POLICY "Admin can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sub_admin'::app_role)
    OR has_role(auth.uid(), 'sales_executive'::app_role)
  );

CREATE POLICY "Admin/SubAdmin can update any order"
  ON public.orders FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sub_admin'::app_role)
  );

CREATE POLICY "Sales executive can update assigned orders"
  ON public.orders FOR UPDATE
  USING (
    has_role(auth.uid(), 'sales_executive'::app_role)
    AND assigned_to = auth.uid()
  );

CREATE POLICY "Admin can delete orders"
  ON public.orders FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
