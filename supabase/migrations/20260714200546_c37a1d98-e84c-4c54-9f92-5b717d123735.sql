
-- ============ CUSTOMERS: analytics fields ============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS first_order_date date,
  ADD COLUMN IF NOT EXISTS last_order_date date,
  ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_orders integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_orders integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_orders integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_orders integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_orders integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_cod numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_shipping numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_order_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_product text,
  ADD COLUMN IF NOT EXISTS last_delivery_status text,
  ADD COLUMN IF NOT EXISTS last_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_executive_name text,
  ADD COLUMN IF NOT EXISTS is_repeat_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS name_manually_edited boolean NOT NULL DEFAULT false;

-- ============ ORDERS: optional import fields ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS external_order_id text,
  ADD COLUMN IF NOT EXISTS tracking_code text,
  ADD COLUMN IF NOT EXISTS invoice_no text,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS delivery_time text,
  ADD COLUMN IF NOT EXISTS rider_name text,
  ADD COLUMN IF NOT EXISTS rider_phone text,
  ADD COLUMN IF NOT EXISTS shipping_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS recipient_name text;

CREATE INDEX IF NOT EXISTS idx_orders_project_external_id
  ON public.orders(project_id, external_order_id)
  WHERE external_order_id IS NOT NULL;

-- ============ IMPORT MAPPING TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.import_mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  source_hint text,
  header_signature text[] NOT NULL DEFAULT '{}',
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_mapping_templates TO authenticated;
GRANT ALL ON public.import_mapping_templates TO service_role;

ALTER TABLE public.import_mapping_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project templates"
  ON public.import_mapping_templates FOR SELECT
  TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "Admins can insert templates"
  ON public.import_mapping_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id = public.get_user_project_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'sub_admin'::app_role))
  );

CREATE POLICY "Admins can update templates"
  ON public.import_mapping_templates FOR UPDATE
  TO authenticated
  USING (
    project_id = public.get_user_project_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'sub_admin'::app_role))
  );

CREATE POLICY "Admins can delete templates"
  ON public.import_mapping_templates FOR DELETE
  TO authenticated
  USING (
    project_id = public.get_user_project_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'sub_admin'::app_role))
  );

CREATE TRIGGER trg_import_mapping_templates_updated
  BEFORE UPDATE ON public.import_mapping_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ IMPORT RUNS (audit) ============
CREATE TABLE IF NOT EXISTS public.import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid,
  user_name text,
  source_filename text,
  total_rows integer NOT NULL DEFAULT 0,
  imported integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  new_customers integer NOT NULL DEFAULT 0,
  existing_customers integer NOT NULL DEFAULT 0,
  repeat_orders integer NOT NULL DEFAULT 0,
  ai_fixed_fields integer NOT NULL DEFAULT 0,
  missing_mandatory integer NOT NULL DEFAULT 0,
  invalid_phone integer NOT NULL DEFAULT 0,
  invalid_cod integer NOT NULL DEFAULT 0,
  processing_ms integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.import_runs TO authenticated;
GRANT ALL ON public.import_runs TO service_role;

ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project import runs"
  ON public.import_runs FOR SELECT
  TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "Members can insert own project import runs"
  ON public.import_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id = public.get_user_project_id(auth.uid())
    AND user_id = auth.uid()
  );

-- ============ Customer analytics recalculation ============
CREATE OR REPLACE FUNCTION public.recalc_customer_analytics(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_total int; r_delivered int; r_pending int; r_cancelled int; r_returned int;
  r_first date; r_last date;
  r_cod numeric; r_ship numeric; r_value numeric; r_aov numeric;
  r_last_prod text; r_last_status text;
BEGIN
  IF p_customer_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE lower(coalesce(delivery_status,'')) = 'delivered'),
    COUNT(*) FILTER (WHERE lower(coalesce(delivery_status,'')) IN ('pending','in transit','hold','')),
    COUNT(*) FILTER (WHERE lower(coalesce(delivery_status,'')) = 'cancelled'),
    COUNT(*) FILTER (WHERE lower(coalesce(delivery_status,'')) = 'returned'),
    MIN(order_date), MAX(order_date),
    COALESCE(SUM(price),0),
    COALESCE(SUM(shipping_charge),0),
    COALESCE(SUM(price + shipping_charge),0)
  INTO r_total, r_delivered, r_pending, r_cancelled, r_returned,
       r_first, r_last, r_cod, r_ship, r_value
  FROM public.orders
  WHERE customer_id = p_customer_id AND is_deleted = false;

  r_aov := CASE WHEN r_total > 0 THEN r_value / r_total ELSE 0 END;

  SELECT product_title, delivery_status
    INTO r_last_prod, r_last_status
  FROM public.orders
  WHERE customer_id = p_customer_id AND is_deleted = false
  ORDER BY order_date DESC NULLS LAST, created_at DESC
  LIMIT 1;

  UPDATE public.customers
  SET total_orders = r_total,
      delivered_orders = r_delivered,
      pending_orders = r_pending,
      cancelled_orders = r_cancelled,
      returned_orders = r_returned,
      first_order_date = r_first,
      last_order_date = r_last,
      lifetime_cod = r_cod,
      lifetime_shipping = r_ship,
      lifetime_value = r_value,
      avg_order_value = r_aov,
      last_product = r_last_prod,
      last_delivery_status = r_last_status,
      repeat_orders = GREATEST(r_total - 1, 0),
      is_repeat_customer = (r_total > 1),
      is_active = (r_last IS NOT NULL AND r_last >= (CURRENT_DATE - INTERVAL '60 days')::date),
      stage = CASE
        WHEN r_total = 0 THEN 'new'
        WHEN r_total = 1 THEN 'first-time'
        WHEN r_total BETWEEN 2 AND 4 THEN 'repeat'
        ELSE 'loyal'
      END,
      updated_at = now()
  WHERE id = p_customer_id;
END;
$$;

-- Trigger on orders to keep customer analytics fresh
CREATE OR REPLACE FUNCTION public.trg_orders_recalc_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_customer_analytics(OLD.customer_id);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    PERFORM public.recalc_customer_analytics(OLD.customer_id);
  END IF;
  PERFORM public.recalc_customer_analytics(NEW.customer_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_recalc_customer_analytics ON public.orders;
CREATE TRIGGER orders_recalc_customer_analytics
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_recalc_customer();

-- Trigger on followup_history for last_followup_at / last_executive_name
CREATE OR REPLACE FUNCTION public.trg_followup_touch_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_customer_id uuid;
BEGIN
  SELECT customer_id INTO v_customer_id FROM public.orders WHERE id = NEW.order_id;
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
      SET last_followup_at = NEW.completed_at,
          last_executive_name = COALESCE(NEW.completed_by_name, last_executive_name),
          updated_at = now()
      WHERE id = v_customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS followup_history_touch_customer ON public.followup_history;
CREATE TRIGGER followup_history_touch_customer
  AFTER INSERT ON public.followup_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_followup_touch_customer();

-- ============ Update find_or_create_customer to respect manual name lock ============
CREATE OR REPLACE FUNCTION public.find_or_create_customer(p_name text, p_mobile text, p_address text, p_project_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_lock_key bigint;
  v_project_id uuid;
  v_name_locked boolean;
BEGIN
  v_project_id := COALESCE(p_project_id, public.get_user_project_id(auth.uid()));

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Cannot resolve project for customer upsert';
  END IF;

  v_lock_key := hashtext(v_project_id::text || '|' || p_mobile);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id, name_manually_edited
    INTO v_customer_id, v_name_locked
  FROM public.customers
  WHERE mobile_number = p_mobile AND project_id = v_project_id;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
      SET address = CASE WHEN p_address IS NOT NULL AND p_address <> '' THEN p_address ELSE address END,
          updated_at = now()
      WHERE id = v_customer_id;
    RETURN v_customer_id;
  END IF;

  INSERT INTO public.customers (name, mobile_number, address, project_id)
  VALUES (COALESCE(NULLIF(p_name,''),'Unknown'), p_mobile, COALESCE(p_address,''), v_project_id)
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;
