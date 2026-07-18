
-- 1) Requeue orphaned "running" batches (worker crashed / timed out)
CREATE OR REPLACE FUNCTION public.requeue_orphaned_import_batches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.import_queue
       SET status = 'queued',
           worker_id = NULL,
           next_attempt_at = now() + (LEAST(attempts, 5) * interval '30 seconds'),
           last_error = COALESCE(last_error, 'worker_orphaned'),
           updated_at = now()
     WHERE status = 'running'
       AND started_at < now() - interval '3 minutes'
       AND attempts < COALESCE(max_attempts, 5)
     RETURNING id, import_run_id, batch_index
  )
  UPDATE public.import_batches b
     SET status = 'pending', updated_at = now()
   FROM upd
   WHERE b.import_run_id = upd.import_run_id
     AND b.batch_index = upd.batch_index;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.requeue_orphaned_import_batches() TO service_role;

-- 2) Watchdog: requeue orphans, then poke worker if any queued work exists.
--    Uses net.http_post (pg_net) against the project's edge function with the
--    project anon key. verify_jwt is false for Lovable-managed functions, so
--    the anon Bearer is sufficient to boot the worker.
CREATE OR REPLACE FUNCTION public.kick_import_worker_if_needed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queued integer;
BEGIN
  PERFORM public.requeue_orphaned_import_batches();

  SELECT count(*) INTO v_queued
  FROM public.import_queue
  WHERE status = 'queued'
    AND next_attempt_at <= now();

  IF v_queued = 0 THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://exxonqrcomkgyilhvoyt.supabase.co/functions/v1/import-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eG9ucXJjb21rZ3lpbGh2b3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExODk1MjksImV4cCI6MjA4Njc2NTUyOX0.SX9CUUguVNgwaG7wGLAZNnrhkPHhFTJ08AhNruxH0Ak'
    ),
    body := '{"source":"watchdog"}'::jsonb,
    timeout_milliseconds := 5000
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.kick_import_worker_if_needed() TO service_role;

-- 3) Schedule the watchdog every minute (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'import_worker_watchdog') THEN
    PERFORM cron.unschedule('import_worker_watchdog');
  END IF;
  PERFORM cron.schedule(
    'import_worker_watchdog',
    '* * * * *',
    $cron$ SELECT public.kick_import_worker_if_needed(); $cron$
  );
END $$;
