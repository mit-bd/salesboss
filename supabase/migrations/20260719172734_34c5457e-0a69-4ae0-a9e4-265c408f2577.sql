
-- 1. Phone normalization
CREATE OR REPLACE FUNCTION public.normalize_phone_bd(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE d text;
BEGIN
  IF p_raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(p_raw, '\D', '', 'g');
  IF d = '' THEN RETURN ''; END IF;
  IF length(d) = 13 AND left(d, 3) = '880' THEN
    d := '0' || substr(d, 4);
  ELSIF length(d) = 12 AND left(d, 2) = '88' THEN
    d := '0' || substr(d, 3);
  ELSIF length(d) = 10 AND left(d, 1) = '1' THEN
    d := '0' || d;
  END IF;
  RETURN d;
END;
$$;
GRANT EXECUTE ON FUNCTION public.normalize_phone_bd(text) TO anon, authenticated, service_role;

-- 2. Backfill
UPDATE public.customers
   SET mobile_number = public.normalize_phone_bd(mobile_number)
 WHERE mobile_number IS DISTINCT FROM public.normalize_phone_bd(mobile_number);

UPDATE public.orders
   SET mobile = public.normalize_phone_bd(mobile)
 WHERE mobile IS DISTINCT FROM public.normalize_phone_bd(mobile);

-- 3. Uniqueness on normalized phone per project
DROP INDEX IF EXISTS public.customers_project_normphone_unique;
CREATE UNIQUE INDEX customers_project_normphone_unique
  ON public.customers (project_id, public.normalize_phone_bd(mobile_number));

-- 4. Drop both existing overloads, then recreate the canonical version
DROP FUNCTION IF EXISTS public.find_or_create_customer(text, text, text);
DROP FUNCTION IF EXISTS public.find_or_create_customer(text, text, text, uuid);

CREATE FUNCTION public.find_or_create_customer(
  p_name text,
  p_mobile text,
  p_address text,
  p_project_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_phone text;
BEGIN
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'project_id required';
  END IF;
  v_phone := public.normalize_phone_bd(p_mobile);
  IF v_phone IS NULL OR v_phone = '' THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_project_id::text || '|' || v_phone));

  SELECT id INTO v_customer_id
    FROM public.customers
   WHERE project_id = p_project_id
     AND public.normalize_phone_bd(mobile_number) = v_phone
   LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
       SET address = CASE
             WHEN COALESCE(address, '') = '' AND COALESCE(p_address, '') <> ''
             THEN p_address ELSE address
           END,
           updated_at = now()
     WHERE id = v_customer_id;
    RETURN v_customer_id;
  END IF;

  INSERT INTO public.customers (project_id, name, mobile_number, address)
  VALUES (p_project_id, COALESCE(NULLIF(p_name, ''), 'Unknown'), v_phone, COALESCE(p_address, ''))
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.find_or_create_customer(text, text, text, uuid)
  TO authenticated, service_role;

-- 5. Duplicate detection
CREATE OR REPLACE FUNCTION public.detect_order_duplicate(
  p_project_id uuid,
  p_mobile text,
  p_external_order_id text DEFAULT NULL,
  p_tracking_code text DEFAULT NULL,
  p_invoice_no text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_customer_id uuid;
  v_same_order_id uuid;
  v_same_tracking uuid;
  v_same_invoice uuid;
  v_case text := 'none';
BEGIN
  v_phone := public.normalize_phone_bd(p_mobile);
  IF v_phone IS NOT NULL AND v_phone <> '' THEN
    SELECT id INTO v_customer_id
      FROM public.customers
     WHERE project_id = p_project_id
       AND public.normalize_phone_bd(mobile_number) = v_phone
     LIMIT 1;
  END IF;

  IF NULLIF(trim(p_external_order_id), '') IS NOT NULL THEN
    SELECT id INTO v_same_order_id FROM public.orders
     WHERE project_id = p_project_id AND is_deleted = false
       AND external_order_id = trim(p_external_order_id) LIMIT 1;
  END IF;
  IF NULLIF(trim(p_tracking_code), '') IS NOT NULL THEN
    SELECT id INTO v_same_tracking FROM public.orders
     WHERE project_id = p_project_id AND is_deleted = false
       AND tracking_code = trim(p_tracking_code) LIMIT 1;
  END IF;
  IF NULLIF(trim(p_invoice_no), '') IS NOT NULL THEN
    SELECT id INTO v_same_invoice FROM public.orders
     WHERE project_id = p_project_id AND is_deleted = false
       AND invoice_no = trim(p_invoice_no) LIMIT 1;
  END IF;

  IF v_same_order_id IS NOT NULL AND v_customer_id IS NOT NULL THEN
    v_case := 'same_mobile_same_order_id';
  ELSIF v_same_order_id IS NOT NULL THEN
    v_case := 'same_order_id';
  ELSIF v_customer_id IS NOT NULL THEN
    v_case := 'existing_customer_new_order';
  ELSIF v_same_tracking IS NOT NULL THEN
    v_case := 'same_tracking';
  ELSIF v_same_invoice IS NOT NULL THEN
    v_case := 'same_invoice';
  END IF;

  RETURN jsonb_build_object(
    'case', v_case,
    'customer_id', v_customer_id,
    'duplicate_order_id', COALESCE(v_same_order_id, v_same_tracking, v_same_invoice),
    'matched_by', jsonb_build_object(
      'mobile', v_customer_id IS NOT NULL,
      'external_order_id', v_same_order_id IS NOT NULL,
      'tracking_code', v_same_tracking IS NOT NULL,
      'invoice_no', v_same_invoice IS NOT NULL
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.detect_order_duplicate(uuid, text, text, text, text)
  TO authenticated, service_role;

-- 6. Audit log table (created BEFORE merge function references it)
CREATE TABLE IF NOT EXISTS public.duplicate_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action text NOT NULL,
  case_type text,
  existing_order_id uuid,
  incoming_payload jsonb,
  canonical_customer_id uuid,
  loser_customer_id uuid,
  actor_user_id uuid,
  actor_name text,
  reason text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.duplicate_audit_log TO authenticated;
GRANT ALL ON public.duplicate_audit_log TO service_role;
ALTER TABLE public.duplicate_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view duplicate audit" ON public.duplicate_audit_log;
CREATE POLICY "Project members can view duplicate audit"
  ON public.duplicate_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role)
      OR project_id = public.get_user_project_id(auth.uid()));

DROP POLICY IF EXISTS "Project members can insert duplicate audit" ON public.duplicate_audit_log;
CREATE POLICY "Project members can insert duplicate audit"
  ON public.duplicate_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role)
           OR project_id = public.get_user_project_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_dup_audit_project_created
  ON public.duplicate_audit_log (project_id, created_at DESC);

-- 7. Safe customer merge
CREATE OR REPLACE FUNCTION public.merge_customers(
  p_canonical_id uuid,
  p_loser_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_canonical public.customers;
  v_loser public.customers;
  v_orders int := 0;
  v_tags int := 0;
  v_memory int := 0;
BEGIN
  IF p_canonical_id = p_loser_id THEN
    RAISE EXCEPTION 'canonical and loser must differ';
  END IF;
  SELECT * INTO v_canonical FROM public.customers WHERE id = p_canonical_id FOR UPDATE;
  SELECT * INTO v_loser     FROM public.customers WHERE id = p_loser_id     FOR UPDATE;
  IF v_canonical.id IS NULL OR v_loser.id IS NULL THEN
    RAISE EXCEPTION 'customer not found';
  END IF;
  IF v_canonical.project_id <> v_loser.project_id THEN
    RAISE EXCEPTION 'cross-project merge not allowed';
  END IF;
  IF NOT (public.has_role(v_user, 'owner'::app_role) OR public.has_role(v_user, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Only Owner or Admin can merge customers' USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders SET customer_id = p_canonical_id, updated_at = now()
    WHERE customer_id = p_loser_id;
  GET DIAGNOSTICS v_orders = ROW_COUNT;

  UPDATE public.customer_tags SET customer_id = p_canonical_id
    WHERE customer_id = p_loser_id;
  GET DIAGNOSTICS v_tags = ROW_COUNT;

  UPDATE public.customer_memory_events SET customer_id = p_canonical_id
    WHERE customer_id = p_loser_id;
  GET DIAGNOSTICS v_memory = ROW_COUNT;

  IF NOT EXISTS (SELECT 1 FROM public.customer_ai_profiles WHERE customer_id = p_canonical_id) THEN
    UPDATE public.customer_ai_profiles SET customer_id = p_canonical_id WHERE customer_id = p_loser_id;
  ELSE
    DELETE FROM public.customer_ai_profiles WHERE customer_id = p_loser_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customer_ai_scores WHERE customer_id = p_canonical_id) THEN
    UPDATE public.customer_ai_scores SET customer_id = p_canonical_id WHERE customer_id = p_loser_id;
  ELSE
    DELETE FROM public.customer_ai_scores WHERE customer_id = p_loser_id;
  END IF;

  DELETE FROM public.customers WHERE id = p_loser_id;

  PERFORM public.recalc_customer_analytics(p_canonical_id);
  PERFORM public.apply_customer_tags(p_canonical_id);

  INSERT INTO public.duplicate_audit_log
    (project_id, action, canonical_customer_id, loser_customer_id, actor_user_id, reason, details)
  VALUES (
    v_canonical.project_id, 'merge_customers', p_canonical_id, p_loser_id, v_user, p_reason,
    jsonb_build_object('orders_moved', v_orders, 'tags_moved', v_tags, 'memory_moved', v_memory)
  );

  RETURN jsonb_build_object('ok', true, 'orders_moved', v_orders, 'tags_moved', v_tags, 'memory_moved', v_memory);
END;
$$;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid, text) TO authenticated, service_role;
