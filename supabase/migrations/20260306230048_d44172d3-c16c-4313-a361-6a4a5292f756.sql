
-- Create projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  owner_user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create project_requests table
CREATE TABLE public.project_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  business_name text NOT NULL,
  owner_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  project_id uuid REFERENCES public.projects(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_requests ENABLE ROW LEVEL SECURITY;

-- Add project_id to data tables
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.delivery_methods ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.order_sources ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- Helper function to get user project_id
CREATE OR REPLACE FUNCTION public.get_user_project_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT project_id FROM public.profiles WHERE user_id = _user_id AND project_id IS NOT NULL LIMIT 1
$$;

-- RLS for projects
CREATE POLICY "Owner can view all projects" ON public.projects FOR SELECT TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update projects" ON public.projects FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete projects" ON public.projects FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Project members view own project" ON public.projects FOR SELECT TO authenticated USING (id = get_user_project_id(auth.uid()));

-- RLS for project_requests
CREATE POLICY "Owner can view all requests" ON public.project_requests FOR SELECT TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update requests" ON public.project_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Users can view own request" ON public.project_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Trigger can insert requests" ON public.project_requests FOR INSERT TO authenticated WITH CHECK (true);

-- Update handle_new_user to support owner role and project requests
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner_count INTEGER;
  _business_name TEXT;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'phone', ''));

  SELECT COUNT(*) INTO _owner_count FROM public.user_roles WHERE role = 'owner';
  IF _owner_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    _business_name := NEW.raw_user_meta_data->>'business_name';
    IF _business_name IS NOT NULL AND _business_name != '' THEN
      INSERT INTO public.project_requests (user_id, business_name, owner_name, email, phone)
      VALUES (
        NEW.id,
        _business_name,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', '')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create default project for existing data and assign to existing admin
DO $$
DECLARE
  _admin_user_id uuid;
  _project_id uuid;
BEGIN
  SELECT user_id INTO _admin_user_id FROM public.user_roles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
  IF _admin_user_id IS NOT NULL THEN
    INSERT INTO public.projects (business_name, owner_user_id)
    VALUES ('Default Business', _admin_user_id)
    RETURNING id INTO _project_id;

    UPDATE public.orders SET project_id = _project_id WHERE project_id IS NULL;
    UPDATE public.customers SET project_id = _project_id WHERE project_id IS NULL;
    UPDATE public.products SET project_id = _project_id WHERE project_id IS NULL;
    UPDATE public.delivery_methods SET project_id = _project_id WHERE project_id IS NULL;
    UPDATE public.order_sources SET project_id = _project_id WHERE project_id IS NULL;
    UPDATE public.profiles SET project_id = _project_id WHERE user_id = _admin_user_id;
  END IF;
END $$;
