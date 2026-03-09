
-- Commission configs: per-executive settings controlled by admin
CREATE TABLE public.commission_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  type text NOT NULL DEFAULT 'percentage',
  rate numeric NOT NULL DEFAULT 5,
  apply_on text NOT NULL DEFAULT 'repeat_orders',
  min_order_value numeric NOT NULL DEFAULT 0,
  max_commission_cap numeric,
  auto_generate boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(executive_id, project_id)
);

ALTER TABLE public.commission_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can do all on commission_configs" ON public.commission_configs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "SE can view own commission config" ON public.commission_configs
  FOR SELECT TO authenticated
  USING (executive_id = auth.uid());

-- Sales targets: per-executive targets set by admin
CREATE TABLE public.sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  period_type text NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  end_date date NOT NULL,
  target_orders integer NOT NULL DEFAULT 0,
  target_repeat_orders integer NOT NULL DEFAULT 0,
  target_revenue numeric NOT NULL DEFAULT 0,
  target_upsell_count integer NOT NULL DEFAULT 0,
  target_followups integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can do all on sales_targets" ON public.sales_targets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "SE can view own targets" ON public.sales_targets
  FOR SELECT TO authenticated
  USING (executive_id = auth.uid());

-- Commission entries: individual commission records
CREATE TABLE public.commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_invoice text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'auto',
  paid_date date,
  payment_note text NOT NULL DEFAULT '',
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can do all on commission_entries" ON public.commission_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "SE can view own entries" ON public.commission_entries
  FOR SELECT TO authenticated
  USING (executive_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_targets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_entries;

-- Updated_at triggers
CREATE TRIGGER update_commission_configs_updated_at
  BEFORE UPDATE ON public.commission_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_targets_updated_at
  BEFORE UPDATE ON public.sales_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
