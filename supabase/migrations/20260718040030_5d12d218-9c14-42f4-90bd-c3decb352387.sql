
ALTER TABLE public.import_runs
  ADD COLUMN IF NOT EXISTS import_mode text NOT NULL DEFAULT 'quick',
  ADD COLUMN IF NOT EXISTS mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS duplicate_decisions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS assignments jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS chunk_size integer NOT NULL DEFAULT 300;

ALTER TABLE public.import_queue
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS max_attempts smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS import_mode text NOT NULL DEFAULT 'quick';

CREATE INDEX IF NOT EXISTS idx_import_queue_next_attempt
  ON public.import_queue(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS public.ai_normalization_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  kind text NOT NULL,
  input_hash text NOT NULL,
  input text NOT NULL,
  output text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1,
  hits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, kind, input_hash)
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup
  ON public.ai_normalization_cache(project_id, kind, input_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_normalization_cache TO authenticated;
GRANT ALL ON public.ai_normalization_cache TO service_role;
ALTER TABLE public.ai_normalization_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project members read ai_cache" ON public.ai_normalization_cache
  FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));
CREATE POLICY "project members write ai_cache" ON public.ai_normalization_cache
  FOR ALL TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()))
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

DROP FUNCTION IF EXISTS public.claim_next_import_batch(text);

CREATE FUNCTION public.claim_next_import_batch(p_worker_id text)
RETURNS TABLE (
  id uuid, import_run_id uuid, project_id uuid,
  batch_index integer, payload_ref text, import_mode text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT q.id, q.import_run_id, q.project_id, q.batch_index, q.payload_ref, q.import_mode
    INTO r
  FROM public.import_queue q
  WHERE q.status = 'queued'
    AND q.next_attempt_at <= now()
  ORDER BY q.next_attempt_at, q.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF r.id IS NULL THEN RETURN; END IF;

  UPDATE public.import_queue
    SET status = 'running', worker_id = p_worker_id, started_at = now(),
        attempts = attempts + 1, updated_at = now()
    WHERE public.import_queue.id = r.id;

  UPDATE public.import_batches
    SET status = 'running', updated_at = now()
    WHERE import_run_id = r.import_run_id AND batch_index = r.batch_index;

  id := r.id;
  import_run_id := r.import_run_id;
  project_id := r.project_id;
  batch_index := r.batch_index;
  payload_ref := r.payload_ref;
  import_mode := r.import_mode;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_import_batch(
  p_queue_id uuid, p_category text, p_message text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run uuid; v_batch integer; v_project uuid;
  v_attempts integer; v_max integer;
  v_delay_seconds integer;
  v_new_status text;
BEGIN
  SELECT import_run_id, batch_index, project_id, attempts, max_attempts
    INTO v_run, v_batch, v_project, v_attempts, v_max
  FROM public.import_queue WHERE id = p_queue_id;

  IF v_attempts >= v_max THEN
    v_new_status := 'failed';
  ELSE
    v_new_status := 'queued';
  END IF;

  v_delay_seconds := LEAST(30 * (2 ^ GREATEST(v_attempts - 1, 0))::int, 900);

  UPDATE public.import_queue
    SET status = v_new_status,
        last_error = p_message,
        finished_at = CASE WHEN v_new_status = 'failed' THEN now() ELSE NULL END,
        next_attempt_at = CASE WHEN v_new_status = 'queued'
                               THEN now() + make_interval(secs => v_delay_seconds)
                               ELSE next_attempt_at END,
        worker_id = NULL,
        updated_at = now()
    WHERE id = p_queue_id;

  UPDATE public.import_batches
    SET status = CASE WHEN v_new_status = 'failed' THEN 'failed' ELSE 'pending' END,
        error_category = p_category,
        error_message = p_message,
        retry_count = retry_count + 1,
        updated_at = now()
    WHERE import_run_id = v_run AND batch_index = v_batch;

  IF v_new_status = 'failed' THEN
    INSERT INTO public.import_errors(import_run_id, project_id, batch_index, category, why, recommended_fix, retryable)
    VALUES (v_run, v_project, v_batch, p_category, p_message,
      'Retry from the Recovery Center after fixing the source data.', true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_import_batches(
  p_run_id uuid,
  p_project_id uuid,
  p_total_batches integer
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i integer;
  v_chunk integer;
  v_mode text;
BEGIN
  SELECT COALESCE(chunk_size, 300), COALESCE(import_mode, 'quick')
    INTO v_chunk, v_mode
  FROM public.import_runs WHERE id = p_run_id;

  FOR i IN 0..(p_total_batches - 1) LOOP
    INSERT INTO public.import_queue(import_run_id, project_id, batch_index, total_batches, status, import_mode, next_attempt_at)
    VALUES (p_run_id, p_project_id, i, p_total_batches, 'queued', v_mode, now())
    ON CONFLICT (import_run_id, batch_index) DO NOTHING;

    INSERT INTO public.import_batches(import_run_id, project_id, batch_index, row_start, row_end, status)
    VALUES (p_run_id, p_project_id, i, i * v_chunk, (i + 1) * v_chunk, 'pending')
    ON CONFLICT (import_run_id, batch_index) DO NOTHING;
  END LOOP;

  UPDATE public.import_runs SET total_batches = p_total_batches WHERE id = p_run_id;
  RETURN p_total_batches;
END;
$$;
