
-- 1. Backfill project_id on customers from the earliest related order
UPDATE public.customers c
SET project_id = sub.project_id
FROM (
  SELECT DISTINCT ON (o.customer_id) o.customer_id, o.project_id
  FROM public.orders o
  WHERE o.customer_id IS NOT NULL AND o.project_id IS NOT NULL
  ORDER BY o.customer_id, o.created_at ASC
) sub
WHERE c.id = sub.customer_id AND c.project_id IS NULL;

-- 2. Replace global mobile uniqueness with per-project uniqueness
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_mobile_number_unique;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_mobile_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_project_mobile_unique'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_project_mobile_unique UNIQUE (project_id, mobile_number);
  END IF;
END $$;

-- 3. Enforce NOT NULL only if backfill succeeded for every row
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining FROM public.customers WHERE project_id IS NULL;
  IF remaining = 0 THEN
    ALTER TABLE public.customers ALTER COLUMN project_id SET NOT NULL;
  END IF;
END $$;

-- 4. Tighten INSERT policy to require the caller's project_id
DROP POLICY IF EXISTS "Authenticated can insert customers" ON public.customers;
CREATE POLICY "Authenticated can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sub_admin'::app_role)
    OR has_role(auth.uid(), 'sales_executive'::app_role))
  AND project_id IS NOT NULL
  AND project_id = get_user_project_id(auth.uid())
);

-- 5. Harden find_or_create_customer to scope by project and auto-set project_id
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  p_name text,
  p_mobile text,
  p_address text,
  p_project_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_lock_key bigint;
  v_project_id uuid;
BEGIN
  v_project_id := COALESCE(p_project_id, public.get_user_project_id(auth.uid()));

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Cannot resolve project for customer upsert';
  END IF;

  v_lock_key := hashtext(v_project_id::text || '|' || p_mobile);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE mobile_number = p_mobile AND project_id = v_project_id;

  IF v_customer_id IS NOT NULL THEN
    IF p_address IS NOT NULL AND p_address != '' THEN
      UPDATE public.customers
      SET address = p_address,
          name = COALESCE(NULLIF(p_name, ''), name),
          updated_at = now()
      WHERE id = v_customer_id;
    END IF;
    RETURN v_customer_id;
  END IF;

  INSERT INTO public.customers (name, mobile_number, address, project_id)
  VALUES (p_name, p_mobile, p_address, v_project_id)
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.find_or_create_customer(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_customer(text, text, text, uuid) TO authenticated, service_role;
