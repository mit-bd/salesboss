
-- Table for predefined followup problems
CREATE TABLE public.followup_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view followup problems"
  ON public.followup_problems FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/SubAdmin can insert followup problems"
  ON public.followup_problems FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin/SubAdmin can update followup problems"
  ON public.followup_problems FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin can delete followup problems"
  ON public.followup_problems FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Table for custom quick info fields
CREATE TABLE public.followup_quick_info_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  options jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_quick_info_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quick info fields"
  ON public.followup_quick_info_fields FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/SubAdmin can insert quick info fields"
  ON public.followup_quick_info_fields FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin/SubAdmin can update quick info fields"
  ON public.followup_quick_info_fields FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin can delete quick info fields"
  ON public.followup_quick_info_fields FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default problems
INSERT INTO public.followup_problems (label, sort_order) VALUES
  ('ধাতু ক্ষয়', 1),
  ('ঘন ঘন প্রসাব', 2),
  ('প্রসাবের সাথে বির্জ আসা', 3),
  ('মিলনে সময় কম', 4),
  ('শরীর দুর্বল', 5),
  ('স্বপ্নদোষ', 6);

-- Seed default quick info fields
INSERT INTO public.followup_quick_info_fields (label, field_type, options, sort_order) VALUES
  ('বয়স (Age)', 'text', '[]'::jsonb, 1),
  ('কত দিন ধরে সমস্যা (Duration)', 'text', '[]'::jsonb, 2),
  ('বিবাহিত / অবিবাহিত (Marital Status)', 'select', '["বিবাহিত", "অবিবাহিত"]'::jsonb, 3);
