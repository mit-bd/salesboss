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

NOTIFY pgrst, 'reload schema';