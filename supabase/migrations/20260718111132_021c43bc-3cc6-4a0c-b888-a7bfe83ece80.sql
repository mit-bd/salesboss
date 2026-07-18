DROP POLICY IF EXISTS "Members can update own project import runs" ON public.import_runs;

CREATE POLICY "Members can update own project import runs"
ON public.import_runs
FOR UPDATE
TO authenticated
USING (
  project_id = public.get_user_project_id(auth.uid())
  AND user_id = auth.uid()
)
WITH CHECK (
  project_id = public.get_user_project_id(auth.uid())
  AND user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.claim_next_import_batch(p_worker_id text)
RETURNS TABLE (
  id uuid,
  import_run_id uuid,
  project_id uuid,
  batch_index integer,
  payload_ref text,
  import_mode text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT q.id, q.import_run_id, q.project_id, q.batch_index, q.payload_ref, q.import_mode
    INTO r
  FROM public.import_queue AS q
  WHERE q.status = 'queued'
    AND q.next_attempt_at <= now()
  ORDER BY q.next_attempt_at, q.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF r.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.import_queue AS q
    SET status = 'running',
        worker_id = p_worker_id,
        started_at = now(),
        attempts = q.attempts + 1,
        updated_at = now()
    WHERE q.id = r.id;

  UPDATE public.import_batches AS b
    SET status = 'running',
        updated_at = now()
    WHERE b.import_run_id = r.import_run_id
      AND b.batch_index = r.batch_index;

  id := r.id;
  import_run_id := r.import_run_id;
  project_id := r.project_id;
  batch_index := r.batch_index;
  payload_ref := r.payload_ref;
  import_mode := r.import_mode;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_import_batch(
  p_queue_id uuid,
  p_rows_ok integer,
  p_rows_failed integer,
  p_duration_ms integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run uuid;
  v_batch integer;
BEGIN
  SELECT q.import_run_id, q.batch_index
    INTO v_run, v_batch
  FROM public.import_queue AS q
  WHERE q.id = p_queue_id;

  IF v_run IS NULL THEN
    RAISE EXCEPTION 'Import queue row not found: %', p_queue_id;
  END IF;

  UPDATE public.import_queue AS q
    SET status = 'completed',
        finished_at = now(),
        updated_at = now()
    WHERE q.id = p_queue_id;

  UPDATE public.import_batches AS b
    SET status = 'completed',
        rows_ok = p_rows_ok,
        rows_failed = p_rows_failed,
        duration_ms = p_duration_ms,
        updated_at = now()
    WHERE b.import_run_id = v_run
      AND b.batch_index = v_batch;

  UPDATE public.import_runs AS r
    SET processed_batches = COALESCE(r.processed_batches, 0) + 1,
        imported = COALESCE(r.imported, 0) + GREATEST(p_rows_ok, 0),
        skipped = COALESCE(r.skipped, 0) + GREATEST(p_rows_failed, 0),
        speed_rows_per_sec = CASE
          WHEN p_duration_ms > 0 THEN (p_rows_ok::numeric * 1000.0 / p_duration_ms)
          ELSE r.speed_rows_per_sec
        END,
        updated_at = now(),
        status = CASE
          WHEN COALESCE(r.processed_batches, 0) + 1 >= COALESCE(NULLIF(r.total_batches, 0), 1)
          THEN 'completed'
          ELSE 'processing'
        END,
        finished_at = CASE
          WHEN COALESCE(r.processed_batches, 0) + 1 >= COALESCE(NULLIF(r.total_batches, 0), 1)
          THEN now()
          ELSE r.finished_at
        END
    WHERE r.id = v_run;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_import_batch(
  p_queue_id uuid,
  p_category text,
  p_message text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run uuid;
  v_batch integer;
  v_project uuid;
  v_attempts integer;
  v_max integer;
  v_delay_seconds integer;
  v_new_status text;
BEGIN
  SELECT q.import_run_id, q.batch_index, q.project_id, q.attempts, q.max_attempts
    INTO v_run, v_batch, v_project, v_attempts, v_max
  FROM public.import_queue AS q
  WHERE q.id = p_queue_id;

  IF v_run IS NULL THEN
    RAISE EXCEPTION 'Import queue row not found: %', p_queue_id;
  END IF;

  IF v_attempts >= v_max THEN
    v_new_status := 'failed';
  ELSE
    v_new_status := 'queued';
  END IF;

  v_delay_seconds := LEAST(30 * (2 ^ GREATEST(v_attempts - 1, 0))::int, 900);

  UPDATE public.import_queue AS q
    SET status = v_new_status,
        last_error = p_message,
        finished_at = CASE WHEN v_new_status = 'failed' THEN now() ELSE NULL END,
        next_attempt_at = CASE
          WHEN v_new_status = 'queued' THEN now() + make_interval(secs => v_delay_seconds)
          ELSE q.next_attempt_at
        END,
        worker_id = NULL,
        updated_at = now()
    WHERE q.id = p_queue_id;

  UPDATE public.import_batches AS b
    SET status = CASE WHEN v_new_status = 'failed' THEN 'failed' ELSE 'pending' END,
        error_category = p_category,
        error_message = p_message,
        retry_count = b.retry_count + 1,
        updated_at = now()
    WHERE b.import_run_id = v_run
      AND b.batch_index = v_batch;

  UPDATE public.import_runs AS r
    SET status = CASE WHEN v_new_status = 'failed' THEN 'failed' ELSE 'processing' END,
        error_message = p_message,
        updated_at = now(),
        finished_at = CASE WHEN v_new_status = 'failed' THEN now() ELSE r.finished_at END
    WHERE r.id = v_run
      AND v_new_status = 'failed';

  IF v_new_status = 'failed' THEN
    INSERT INTO public.import_errors(import_run_id, project_id, batch_index, category, why, recommended_fix, retryable)
    VALUES (v_run, v_project, v_batch, p_category, p_message,
      'Retry from the Recovery Center after fixing the source data.', true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_import_run_total_batches(
  p_run_id uuid,
  p_total_batches integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_total_batches < 1 THEN
    RAISE EXCEPTION 'Total batches must be at least 1';
  END IF;

  UPDATE public.import_runs AS r
    SET total_batches = p_total_batches,
        updated_at = now()
  WHERE r.id = p_run_id
    AND r.project_id = public.get_user_project_id(auth.uid())
    AND r.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import run not found or not accessible';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_import_run_total_batches(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_import_run_total_batches(uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';