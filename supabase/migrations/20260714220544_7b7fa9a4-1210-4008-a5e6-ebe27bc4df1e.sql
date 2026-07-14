-- customer_ai_scores: cached AI-derived customer scoring
CREATE TABLE public.customer_ai_scores (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasons jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_ai_scores_project ON public.customer_ai_scores(project_id);
CREATE INDEX idx_customer_ai_scores_expires ON public.customer_ai_scores(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_ai_scores TO authenticated;
GRANT ALL ON public.customer_ai_scores TO service_role;

ALTER TABLE public.customer_ai_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read AI scores in their project"
  ON public.customer_ai_scores FOR SELECT
  TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "Users write AI scores in their project"
  ON public.customer_ai_scores FOR INSERT
  TO authenticated
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "Users update AI scores in their project"
  ON public.customer_ai_scores FOR UPDATE
  TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()))
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

CREATE TRIGGER update_customer_ai_scores_updated_at
  BEFORE UPDATE ON public.customer_ai_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();