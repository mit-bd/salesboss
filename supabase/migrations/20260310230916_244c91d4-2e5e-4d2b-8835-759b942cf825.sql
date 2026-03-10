
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS expiry_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active';
