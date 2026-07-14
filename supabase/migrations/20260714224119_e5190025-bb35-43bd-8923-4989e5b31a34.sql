
-- ============================================================================
-- Epic 01 M1: Customer AI Profile + Memory Engine
-- ============================================================================

-- 1. customer_ai_profiles ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_ai_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Personality & behaviour
  personality text,
  buying_behaviour text,
  purchase_pattern text,
  repeat_pattern text,
  price_sensitivity text,
  product_preference text,
  preferred_language text,
  preferred_call_time text,
  preferred_executive_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  preferred_payment text,
  preferred_courier text,

  -- Scores
  loyalty_score numeric(5,2),
  lifetime_trend text, -- e.g. 'growing', 'stable', 'declining'
  ai_confidence numeric(5,2),

  -- Explainability & governance
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_fields text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- Refresh control
  dirty boolean NOT NULL DEFAULT true,
  last_refreshed_at timestamptz,
  model text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_ai_profiles TO authenticated;
GRANT ALL ON public.customer_ai_profiles TO service_role;

ALTER TABLE public.customer_ai_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view all AI profiles"
  ON public.customer_ai_profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Team can view AI profiles in their project"
  ON public.customer_ai_profiles FOR SELECT
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "Team can insert AI profiles in their project"
  ON public.customer_ai_profiles FOR INSERT
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "Team can update AI profiles in their project"
  ON public.customer_ai_profiles FOR UPDATE
  USING (project_id = public.get_user_project_id(auth.uid()))
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "Admins can delete AI profiles in their project"
  ON public.customer_ai_profiles FOR DELETE
  USING (
    project_id = public.get_user_project_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_customer_ai_profiles_project ON public.customer_ai_profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_customer_ai_profiles_dirty ON public.customer_ai_profiles(dirty) WHERE dirty = true;
CREATE INDEX IF NOT EXISTS idx_customer_ai_profiles_last_refreshed ON public.customer_ai_profiles(last_refreshed_at);

CREATE TRIGGER update_customer_ai_profiles_updated_at
  BEFORE UPDATE ON public.customer_ai_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. customer_memory_events --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_memory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Where this memory came from (may be null for AI-derived summaries)
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  followup_id uuid REFERENCES public.followup_history(id) ON DELETE SET NULL,

  -- Memory classification
  event_type text NOT NULL, -- 'conversation','objection','promise','complaint','product_rejected','discount_offered','delivery_issue','upsell_attempt','repeat_order','preference','ai_summary'
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  sentiment text, -- 'positive','neutral','negative'
  importance smallint NOT NULL DEFAULT 3, -- 1..5

  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'system', -- 'system','ai','manual'

  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_memory_events TO authenticated;
GRANT ALL ON public.customer_memory_events TO service_role;

ALTER TABLE public.customer_memory_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view all memory events"
  ON public.customer_memory_events FOR SELECT
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Team can view memory events in their project"
  ON public.customer_memory_events FOR SELECT
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "Team can insert memory events in their project"
  ON public.customer_memory_events FOR INSERT
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "Admins can delete memory events in their project"
  ON public.customer_memory_events FOR DELETE
  USING (
    project_id = public.get_user_project_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_customer_memory_events_customer_time
  ON public.customer_memory_events(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_memory_events_project
  ON public.customer_memory_events(project_id);
CREATE INDEX IF NOT EXISTS idx_customer_memory_events_type
  ON public.customer_memory_events(event_type);


-- 3. Dirty-flag helper -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_ai_profile_dirty(_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
BEGIN
  IF _customer_id IS NULL THEN RETURN; END IF;

  SELECT project_id INTO v_project FROM public.customers WHERE id = _customer_id;
  IF v_project IS NULL THEN RETURN; END IF;

  INSERT INTO public.customer_ai_profiles (customer_id, project_id, dirty)
  VALUES (_customer_id, v_project, true)
  ON CONFLICT (customer_id) DO UPDATE
    SET dirty = true, updated_at = now();
END;
$$;


-- 4. Trigger: mark dirty on order changes ------------------------------------
CREATE OR REPLACE FUNCTION public.trg_orders_mark_ai_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.mark_ai_profile_dirty(OLD.customer_id);
    RETURN OLD;
  END IF;
  PERFORM public.mark_ai_profile_dirty(NEW.customer_id);
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    PERFORM public.mark_ai_profile_dirty(OLD.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_mark_ai_dirty ON public.orders;
CREATE TRIGGER orders_mark_ai_dirty
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_mark_ai_dirty();


-- 5. Trigger: mark dirty on followup completion ------------------------------
CREATE OR REPLACE FUNCTION public.trg_followup_mark_ai_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer uuid;
BEGIN
  SELECT customer_id INTO v_customer FROM public.orders WHERE id = NEW.order_id;
  IF v_customer IS NOT NULL THEN
    PERFORM public.mark_ai_profile_dirty(v_customer);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS followup_mark_ai_dirty ON public.followup_history;
CREATE TRIGGER followup_mark_ai_dirty
  AFTER INSERT ON public.followup_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_followup_mark_ai_dirty();
