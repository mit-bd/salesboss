
-- =========================================================
-- PHASE 2: AI Data Intelligence Engine
-- =========================================================

-- 1. product_aliases -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT GENERATED ALWAYS AS (lower(btrim(alias))) STORED,
  source TEXT,
  confidence NUMERIC DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | pending
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_aliases_project_alias_uniq
  ON public.product_aliases(project_id, normalized_alias);
CREATE INDEX IF NOT EXISTS product_aliases_project_idx ON public.product_aliases(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_aliases TO authenticated;
GRANT ALL ON public.product_aliases TO service_role;
ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_aliases_select_project_members"
  ON public.product_aliases FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "product_aliases_write_admins"
  ON public.product_aliases FOR INSERT TO authenticated
  WITH CHECK (
    project_id = public.get_user_project_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'sub_admin'::app_role)
      OR public.has_role(auth.uid(),'owner'::app_role))
  );

CREATE POLICY "product_aliases_update_admins"
  ON public.product_aliases FOR UPDATE TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'sub_admin'::app_role)
      OR public.has_role(auth.uid(),'owner'::app_role)))
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "product_aliases_delete_admins"
  ON public.product_aliases FOR DELETE TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'sub_admin'::app_role)
      OR public.has_role(auth.uid(),'owner'::app_role)));

CREATE TRIGGER trg_product_aliases_updated_at
  BEFORE UPDATE ON public.product_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. import_warnings -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning', -- critical | warning | suggestion
  field TEXT,
  message TEXT NOT NULL,
  reason TEXT, -- WHY this warning was generated
  suggested_fix JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS import_warnings_run_idx ON public.import_warnings(import_run_id);
CREATE INDEX IF NOT EXISTS import_warnings_project_idx ON public.import_warnings(project_id);
CREATE INDEX IF NOT EXISTS import_warnings_category_idx ON public.import_warnings(category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_warnings TO authenticated;
GRANT ALL ON public.import_warnings TO service_role;
ALTER TABLE public.import_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_warnings_select_project"
  ON public.import_warnings FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "import_warnings_write_project"
  ON public.import_warnings FOR INSERT TO authenticated
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "import_warnings_update_project"
  ON public.import_warnings FOR UPDATE TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()))
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "import_warnings_delete_project"
  ON public.import_warnings FOR DELETE TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

-- 3. import_learning_events -----------------------------------------
CREATE TABLE IF NOT EXISTS public.import_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  import_run_id UUID REFERENCES public.import_runs(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.import_mapping_templates(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- alias_confirmed | mapping_confirmed | duplicate_decision | manual_correction
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS import_learning_events_project_idx ON public.import_learning_events(project_id);
CREATE INDEX IF NOT EXISTS import_learning_events_type_idx ON public.import_learning_events(event_type);

GRANT SELECT, INSERT ON public.import_learning_events TO authenticated;
GRANT ALL ON public.import_learning_events TO service_role;
ALTER TABLE public.import_learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_learning_events_select_project"
  ON public.import_learning_events FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "import_learning_events_insert_project"
  ON public.import_learning_events FOR INSERT TO authenticated
  WITH CHECK (project_id = public.get_user_project_id(auth.uid())
    AND created_by = auth.uid());

-- 4. customer_tags ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  assigned_by TEXT NOT NULL DEFAULT 'ai', -- ai | manual
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_tags_uniq ON public.customer_tags(customer_id, tag);
CREATE INDEX IF NOT EXISTS customer_tags_project_idx ON public.customer_tags(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tags TO authenticated;
GRANT ALL ON public.customer_tags TO service_role;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_tags_select_project"
  ON public.customer_tags FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "customer_tags_insert_admins"
  ON public.customer_tags FOR INSERT TO authenticated
  WITH CHECK (project_id = public.get_user_project_id(auth.uid())
    AND (assigned_by = 'ai'
      OR public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'sub_admin'::app_role)
      OR public.has_role(auth.uid(),'owner'::app_role)));

CREATE POLICY "customer_tags_delete_admins"
  ON public.customer_tags FOR DELETE TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'sub_admin'::app_role)
      OR public.has_role(auth.uid(),'owner'::app_role)));

-- 5. Extend import_runs ---------------------------------------------
ALTER TABLE public.import_runs
  ADD COLUMN IF NOT EXISTS resume_token TEXT,
  ADD COLUMN IF NOT EXISTS last_processed_row INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_score JSONB,
  ADD COLUMN IF NOT EXISTS recommendations JSONB;

-- 6. Extend import_mapping_templates --------------------------------
ALTER TABLE public.import_mapping_templates
  ADD COLUMN IF NOT EXISTS status_aliases JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS date_format TEXT,
  ADD COLUMN IF NOT EXISTS phone_format TEXT,
  ADD COLUMN IF NOT EXISTS product_alias_hints JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- 7. apply_customer_tags --------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_customer_tags(p_customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_days_since_order INTEGER;
  v_days_since_followup INTEGER;
BEGIN
  SELECT * INTO c FROM public.customers WHERE id = p_customer_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Only replace AI-assigned tags; keep manual ones.
  DELETE FROM public.customer_tags
    WHERE customer_id = p_customer_id AND assigned_by = 'ai';

  v_days_since_order := CASE WHEN c.last_order_date IS NOT NULL
    THEN (CURRENT_DATE - c.last_order_date) ELSE NULL END;
  v_days_since_followup := CASE WHEN c.last_followup_at IS NOT NULL
    THEN EXTRACT(DAY FROM (now() - c.last_followup_at))::int ELSE NULL END;

  IF COALESCE(c.total_orders,0) >= 5 AND COALESCE(c.lifetime_value,0) >= 20000 THEN
    INSERT INTO public.customer_tags(customer_id, project_id, tag, assigned_by, reason)
      VALUES (p_customer_id, c.project_id, 'VIP', 'ai',
        'Customer has ' || c.total_orders || ' orders and ৳' || c.lifetime_value || ' lifetime value');
  END IF;

  IF COALESCE(c.total_orders,0) > 1 THEN
    INSERT INTO public.customer_tags(customer_id, project_id, tag, assigned_by, reason)
      VALUES (p_customer_id, c.project_id, 'Repeat Buyer', 'ai',
        'Customer has placed ' || c.total_orders || ' orders');
  END IF;

  IF COALESCE(c.lifetime_value,0) >= 10000 THEN
    INSERT INTO public.customer_tags(customer_id, project_id, tag, assigned_by, reason)
      VALUES (p_customer_id, c.project_id, 'High Value', 'ai',
        'Lifetime revenue ৳' || c.lifetime_value);
  END IF;

  IF COALESCE(c.avg_order_value,0) >= 3000 AND COALESCE(c.delivered_orders,0) >= 1 THEN
    INSERT INTO public.customer_tags(customer_id, project_id, tag, assigned_by, reason)
      VALUES (p_customer_id, c.project_id, 'Upsell Ready', 'ai',
        'Avg order ৳' || round(c.avg_order_value) || ' with delivered history');
  END IF;

  IF v_days_since_order IS NOT NULL AND v_days_since_order BETWEEN 60 AND 180 THEN
    INSERT INTO public.customer_tags(customer_id, project_id, tag, assigned_by, reason)
      VALUES (p_customer_id, c.project_id, 'Dormant', 'ai',
        'No order in ' || v_days_since_order || ' days');
  END IF;

  IF v_days_since_order IS NOT NULL AND v_days_since_order > 180 THEN
    INSERT INTO public.customer_tags(customer_id, project_id, tag, assigned_by, reason)
      VALUES (p_customer_id, c.project_id, 'Lost Customer', 'ai',
        'No order in ' || v_days_since_order || ' days');
  END IF;

  IF COALESCE(c.pending_orders,0) >= 2 THEN
    INSERT INTO public.customer_tags(customer_id, project_id, tag, assigned_by, reason)
      VALUES (p_customer_id, c.project_id, 'High Followup Priority', 'ai',
        c.pending_orders || ' pending orders awaiting followup');
  END IF;

  IF COALESCE(c.lifetime_cod,0) >= 15000 THEN
    INSERT INTO public.customer_tags(customer_id, project_id, tag, assigned_by, reason)
      VALUES (p_customer_id, c.project_id, 'High COD Value', 'ai',
        'Lifetime COD ৳' || c.lifetime_cod);
  END IF;

  IF COALESCE(c.total_orders,0) >= 3
     AND (c.cancelled_orders::numeric / NULLIF(c.total_orders,0)) >= 0.4 THEN
    INSERT INTO public.customer_tags(customer_id, project_id, tag, assigned_by, reason)
      VALUES (p_customer_id, c.project_id, 'Frequently Cancels', 'ai',
        c.cancelled_orders || ' of ' || c.total_orders || ' orders cancelled');
  END IF;
END;
$$;

-- Hook into existing analytics trigger (recreate to also call apply_customer_tags)
CREATE OR REPLACE FUNCTION public.trg_orders_recalc_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_customer_analytics(OLD.customer_id);
    PERFORM public.apply_customer_tags(OLD.customer_id);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    PERFORM public.recalc_customer_analytics(OLD.customer_id);
    PERFORM public.apply_customer_tags(OLD.customer_id);
  END IF;
  PERFORM public.recalc_customer_analytics(NEW.customer_id);
  PERFORM public.apply_customer_tags(NEW.customer_id);
  RETURN NEW;
END;
$$;

-- 8. data_quality_snapshot ------------------------------------------
CREATE OR REPLACE FUNCTION public.data_quality_snapshot(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_project_id IS NULL THEN
    p_project_id := public.get_user_project_id(auth.uid());
  END IF;

  WITH runs AS (
    SELECT * FROM public.import_runs
    WHERE project_id = p_project_id
      AND started_at >= now() - interval '30 days'
  ),
  warn AS (
    SELECT w.category, count(*) AS cnt
    FROM public.import_warnings w
    JOIN runs r ON r.id = w.import_run_id
    GROUP BY w.category
    ORDER BY cnt DESC
    LIMIT 10
  ),
  top_products AS (
    SELECT o.product_title, count(*) AS cnt
    FROM public.orders o
    WHERE o.project_id = p_project_id AND o.is_deleted = false
      AND o.product_title IS NOT NULL
    GROUP BY o.product_title
    ORDER BY cnt DESC LIMIT 10
  ),
  top_templates AS (
    SELECT name, COALESCE(usage_count,0) AS cnt
    FROM public.import_mapping_templates
    WHERE project_id = p_project_id
    ORDER BY cnt DESC LIMIT 10
  )
  SELECT jsonb_build_object(
    'avg_health_score',
      (SELECT COALESCE(avg((health_score->>'overall')::numeric),0) FROM runs WHERE health_score ? 'overall'),
    'imports_this_month',
      (SELECT count(*) FROM public.import_runs
        WHERE project_id = p_project_id
          AND started_at >= date_trunc('month', now())),
    'duplicate_rate',
      (SELECT CASE WHEN sum(total_rows) > 0
        THEN round((sum(duplicate_rows)::numeric / sum(total_rows)) * 100, 2)
        ELSE 0 END FROM runs),
    'repeat_customer_rate',
      (SELECT CASE WHEN count(*) > 0
        THEN round((count(*) FILTER (WHERE is_repeat_customer)::numeric / count(*)) * 100, 2)
        ELSE 0 END
        FROM public.customers WHERE project_id = p_project_id),
    'ai_fix_success_rate',
      (SELECT CASE WHEN sum(total_rows) > 0
        THEN round((sum(cleaned_rows)::numeric / sum(total_rows)) * 100, 2)
        ELSE 0 END FROM runs),
    'top_validation_errors', (SELECT COALESCE(jsonb_agg(jsonb_build_object('category',category,'count',cnt)),'[]'::jsonb) FROM warn),
    'top_products', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name',product_title,'count',cnt)),'[]'::jsonb) FROM top_products),
    'top_templates', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name',name,'count',cnt)),'[]'::jsonb) FROM top_templates)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_customer_tags(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.data_quality_snapshot(UUID) TO authenticated, service_role;
