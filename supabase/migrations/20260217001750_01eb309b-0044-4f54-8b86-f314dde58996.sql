
-- 1. Create customers table
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  mobile_number text NOT NULL,
  address text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_mobile_unique UNIQUE (mobile_number)
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view customers"
ON public.customers FOR SELECT USING (true);

CREATE POLICY "Admin/SubAdmin/SE can insert customers"
ON public.customers FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sub_admin'::app_role)
  OR has_role(auth.uid(), 'sales_executive'::app_role)
);

CREATE POLICY "Admin/SubAdmin can update customers"
ON public.customers FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sub_admin'::app_role)
);

CREATE POLICY "Admin can delete customers"
ON public.customers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp trigger
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add customer_id to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- 3. Migrate existing orders: create customer records from existing data
INSERT INTO public.customers (name, mobile_number, address)
SELECT DISTINCT ON (mobile)
  customer_name,
  mobile,
  address
FROM public.orders
WHERE mobile IS NOT NULL AND mobile != ''
ORDER BY mobile, created_at DESC
ON CONFLICT (mobile_number) DO NOTHING;

-- 4. Link existing orders to their customers
UPDATE public.orders o
SET customer_id = c.id
FROM public.customers c
WHERE o.mobile = c.mobile_number
AND o.customer_id IS NULL;

-- 5. Create find-or-create customer function
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  p_name text,
  p_mobile text,
  p_address text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Try to find existing customer
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE mobile_number = p_mobile;

  IF v_customer_id IS NOT NULL THEN
    -- Update address if new one is provided
    IF p_address IS NOT NULL AND p_address != '' THEN
      UPDATE public.customers
      SET address = p_address, name = COALESCE(NULLIF(p_name, ''), name)
      WHERE id = v_customer_id;
    END IF;
    RETURN v_customer_id;
  END IF;

  -- Create new customer
  INSERT INTO public.customers (name, mobile_number, address)
  VALUES (p_name, p_mobile, p_address)
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;

-- 6. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);

-- 7. Enable realtime for customers
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
