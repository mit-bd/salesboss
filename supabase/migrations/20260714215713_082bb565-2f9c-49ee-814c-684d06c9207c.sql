
-- =========================================================
-- Phase 2.5: Import Engine background queue + audit + learning
-- =========================================================

-- Extend import_runs
ALTER TABLE public.import_runs
  ADD COLUMN IF NOT EXISTS file_storage_path text,
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS total_batches integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_batches integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS speed_rows_per_sec numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_peak_kb integer,
  ADD COLUMN IF NOT EXISTS queue_wait_ms integer,
  ADD COLUMN IF NOT EXISTS resumed_from_row integer,
  ADD COLUMN IF NOT EXISTS resumed_by uuid,
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS device text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS courier_name text;

-- Extend import_mapping_templates
ALTER TABLE public.import_mapping_templates
  ADD COLUMN IF NOT EXISTS success_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fail_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_health_score numeric DEFAULT 0;

-- =========================================================
-- import_queue
-- =========================================================
CREATE TABLE IF NOT EXISTS public.import_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  batch_index integer NOT NULL,
  total_batches integer NOT NULL,
  payload_ref text,
  status text NOT NULL DEFAULT 'queued', -- queued|running|paused|failed|completed|cancelled
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  worker_id text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_run_id, batch_index)
);
CREATE INDEX IF NOT EXISTS idx_import_queue_status ON public.import_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_import_queue_project ON public.import_queue(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_queue TO authenticated;
GRANT ALL ON public.import_queue TO service_role;

ALTER TABLE public.import_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members read import_queue" ON public.import_queue
  FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "project members insert import_queue" ON public.import_queue
  FOR INSERT TO authenticated
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "project members update import_queue" ON public.import_queue
  FOR UPDATE TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "project members delete import_queue" ON public.import_queue
  FOR DELETE TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

-- =========================================================
-- import_batches
-- =========================================================
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  batch_index integer NOT NULL,
  row_start integer NOT NULL,
  row_end integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|running|completed|failed|cancelled
  rows_ok integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error_category text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_run_id, batch_index)
);
CREATE INDEX IF NOT EXISTS idx_import_batches_run ON public.import_batches(import_run_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON public.import_batches(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members read import_batches" ON public.import_batches
  FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "project members write import_batches" ON public.import_batches
  FOR ALL TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()))
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

-- =========================================================
-- import_audit_events
-- =========================================================
CREATE TABLE IF NOT EXISTS public.import_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  actor_user_id uuid,
  actor_name text,
  action text NOT NULL, -- started|resumed|paused|cancelled|completed|failed|retry_batch
  device text,
  browser text,
  ip text,
  bst_timestamp timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_audit_run ON public.import_audit_events(import_run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_audit_project ON public.import_audit_events(project_id, created_at DESC);

GRANT SELECT, INSERT ON public.import_audit_events TO authenticated;
GRANT ALL ON public.import_audit_events TO service_role;

ALTER TABLE public.import_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members read audit" ON public.import_audit_events
  FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "project members insert audit" ON public.import_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

-- =========================================================
-- import_learning_suggestions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.import_learning_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  kind text NOT NULL, -- product_alias|status_alias|column_map|date_format|address_format|courier_field
  input_value text NOT NULL,
  suggested_value text NOT NULL,
  confirmations integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  promoted_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, kind, input_value, suggested_value)
);
CREATE INDEX IF NOT EXISTS idx_learn_project_status ON public.import_learning_suggestions(project_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_learning_suggestions TO authenticated;
GRANT ALL ON public.import_learning_suggestions TO service_role;

ALTER TABLE public.import_learning_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members read learning" ON public.import_learning_suggestions
  FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "project members write learning" ON public.import_learning_suggestions
  FOR ALL TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()))
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

-- =========================================================
-- import_errors
-- =========================================================
CREATE TABLE IF NOT EXISTS public.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  batch_index integer,
  row_index integer,
  category text NOT NULL, -- validation|ai|database|permission|duplicate|network|timeout|file_format|unknown
  why text,
  recommended_fix text,
  retryable boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_errors_run ON public.import_errors(import_run_id, category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_errors TO authenticated;
GRANT ALL ON public.import_errors TO service_role;

ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members read errors" ON public.import_errors
  FOR SELECT TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()));

CREATE POLICY "project members write errors" ON public.import_errors
  FOR ALL TO authenticated
  USING (project_id = public.get_user_project_id(auth.uid()))
  WITH CHECK (project_id = public.get_user_project_id(auth.uid()));

-- =========================================================
-- Idempotency: unique (project_id, external_order_id) where present
-- =========================================================
CREATE UNIQUE INDEX IF NOT EXISTS uidx_orders_project_external_id
  ON public.orders(project_id, external_order_id)
  WHERE external_order_id IS NOT NULL AND is_deleted = false;

-- =========================================================
-- Functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.enqueue_import_batches(
  p_run_id uuid,
  p_project_id uuid,
  p_total_batches integer
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i integer;
BEGIN
  FOR i IN 0..(p_total_batches - 1) LOOP
    INSERT INTO public.import_queue(import_run_id, project_id, batch_index, total_batches, status)
    VALUES (p_run_id, p_project_id, i, p_total_batches, 'queued')
    ON CONFLICT (import_run_id, batch_index) DO NOTHING;

    INSERT INTO public.import_batches(import_run_id, project_id, batch_index, row_start, row_end, status)
    VALUES (p_run_id, p_project_id, i, i * 200, (i + 1) * 200, 'pending')
    ON CONFLICT (import_run_id, batch_index) DO NOTHING;
  END LOOP;

  UPDATE public.import_runs
    SET total_batches = p_total_batches
    WHERE id = p_run_id;

  RETURN p_total_batches;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_import_batch(p_worker_id text)
RETURNS TABLE (id uuid, import_run_id uuid, project_id uuid, batch_index integer, payload_ref text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT q.id, q.import_run_id, q.project_id, q.batch_index, q.payload_ref
    INTO r
  FROM public.import_queue q
  WHERE q.status = 'queued'
  ORDER BY q.created_at
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
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_import_batch(
  p_queue_id uuid, p_rows_ok integer, p_rows_failed integer, p_duration_ms integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run uuid; v_batch integer;
BEGIN
  SELECT import_run_id, batch_index INTO v_run, v_batch
  FROM public.import_queue WHERE id = p_queue_id;

  UPDATE public.import_queue
    SET status = 'completed', finished_at = now(), updated_at = now()
    WHERE id = p_queue_id;

  UPDATE public.import_batches
    SET status = 'completed', rows_ok = p_rows_ok, rows_failed = p_rows_failed,
        duration_ms = p_duration_ms, updated_at = now()
    WHERE import_run_id = v_run AND batch_index = v_batch;

  UPDATE public.import_runs
    SET processed_batches = COALESCE(processed_batches,0) + 1,
        speed_rows_per_sec = CASE WHEN p_duration_ms > 0
          THEN (p_rows_ok::numeric * 1000.0 / p_duration_ms) ELSE speed_rows_per_sec END,
        updated_at = now(),
        status = CASE WHEN COALESCE(processed_batches,0) + 1 >= COALESCE(total_batches,0)
                      THEN 'completed' ELSE status END,
        finished_at = CASE WHEN COALESCE(processed_batches,0) + 1 >= COALESCE(total_batches,0)
                           THEN now() ELSE finished_at END
    WHERE id = v_run;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_import_batch(
  p_queue_id uuid, p_category text, p_message text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run uuid; v_batch integer; v_project uuid;
BEGIN
  SELECT import_run_id, batch_index, project_id INTO v_run, v_batch, v_project
  FROM public.import_queue WHERE id = p_queue_id;

  UPDATE public.import_queue
    SET status = 'failed', last_error = p_message, finished_at = now(), updated_at = now()
    WHERE id = p_queue_id;

  UPDATE public.import_batches
    SET status = 'failed', error_category = p_category, error_message = p_message, updated_at = now()
    WHERE import_run_id = v_run AND batch_index = v_batch;

  INSERT INTO public.import_errors(import_run_id, project_id, batch_index, category, why, recommended_fix, retryable)
  VALUES (v_run, v_project, v_batch, p_category, p_message,
    'Review the batch payload and click Retry Failed Batches from the Recovery Center.', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_failed_batches(p_run_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.import_queue
    SET status = 'queued', last_error = NULL, worker_id = NULL,
        started_at = NULL, finished_at = NULL, updated_at = now()
    WHERE import_run_id = p_run_id AND status = 'failed';
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.import_batches
    SET status = 'pending', retry_count = retry_count + 1, updated_at = now()
    WHERE import_run_id = p_run_id AND status = 'failed';

  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_import_run(
  p_run_id uuid, p_user_id uuid, p_user_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_project uuid; v_next integer; v_last integer;
BEGIN
  SELECT project_id INTO v_project FROM public.import_runs WHERE id = p_run_id;
  IF v_project IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'run_not_found');
  END IF;

  SELECT MIN(batch_index) INTO v_next
  FROM public.import_queue
  WHERE import_run_id = p_run_id AND status IN ('queued','paused','failed');

  SELECT COALESCE(MAX(batch_index), -1) INTO v_last
  FROM public.import_queue
  WHERE import_run_id = p_run_id AND status = 'completed';

  UPDATE public.import_queue
    SET status = 'queued', updated_at = now()
    WHERE import_run_id = p_run_id AND status IN ('paused','failed');

  UPDATE public.import_runs
    SET status = 'processing',
        resumed_by = p_user_id,
        resumed_at = now(),
        resumed_from_row = GREATEST(v_last + 1, 0) * 200,
        updated_at = now()
    WHERE id = p_run_id;

  INSERT INTO public.import_audit_events(import_run_id, project_id, actor_user_id, actor_name, action, metadata)
  VALUES (p_run_id, v_project, p_user_id, p_user_name, 'resumed',
    jsonb_build_object('next_batch', v_next, 'last_completed_batch', v_last));

  RETURN jsonb_build_object('ok', true, 'next_batch', v_next, 'resumed_from_row', GREATEST(v_last + 1, 0) * 200);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_import_run(
  p_run_id uuid, p_user_id uuid, p_user_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_project uuid;
BEGIN
  SELECT project_id INTO v_project FROM public.import_runs WHERE id = p_run_id;
  IF v_project IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'run_not_found');
  END IF;

  UPDATE public.import_queue
    SET status = 'cancelled', updated_at = now()
    WHERE import_run_id = p_run_id AND status IN ('queued','running','paused','failed');

  UPDATE public.import_runs
    SET status = 'cancelled', cancelled_by = p_user_id, cancelled_at = now(), updated_at = now()
    WHERE id = p_run_id;

  INSERT INTO public.import_audit_events(import_run_id, project_id, actor_user_id, actor_name, action)
  VALUES (p_run_id, v_project, p_user_id, p_user_name, 'cancelled');

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_import_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  WITH runs AS (
    SELECT * FROM public.import_runs
    WHERE started_at >= now() - make_interval(days => p_days)
  ),
  today_runs AS (SELECT * FROM public.import_runs WHERE started_at >= date_trunc('day', now())),
  month_runs AS (SELECT * FROM public.import_runs WHERE started_at >= date_trunc('month', now())),
  templates AS (
    SELECT name, usage_count FROM public.import_mapping_templates
    ORDER BY COALESCE(usage_count,0) DESC LIMIT 1
  ),
  couriers AS (
    SELECT courier_name, count(*) c FROM public.import_runs
    WHERE courier_name IS NOT NULL GROUP BY courier_name ORDER BY c DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'today_imports', (SELECT count(*) FROM today_runs),
    'month_imports', (SELECT count(*) FROM month_runs),
    'largest_import', (SELECT COALESCE(MAX(total_rows),0) FROM runs),
    'avg_import_time_ms', (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000),0) FROM runs WHERE finished_at IS NOT NULL),
    'avg_health_score', (SELECT COALESCE(AVG((health_score->>'overall')::numeric),0) FROM runs WHERE health_score ? 'overall'),
    'most_used_template', (SELECT name FROM templates),
    'most_used_courier', (SELECT courier_name FROM couriers),
    'ai_success_rate', (SELECT CASE WHEN SUM(total_rows) > 0
                          THEN ROUND(SUM(cleaned_rows)::numeric / SUM(total_rows) * 100, 2) ELSE 0 END FROM runs),
    'resume_imports', (SELECT count(*) FROM runs WHERE resumed_at IS NOT NULL),
    'import_failures', (SELECT count(*) FROM runs WHERE status = 'failed')
  ) INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_performance_snapshot(p_project_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_project uuid;
BEGIN
  v_project := COALESCE(p_project_id, public.get_user_project_id(auth.uid()));
  WITH runs AS (
    SELECT * FROM public.import_runs
    WHERE project_id = v_project AND started_at >= now() - interval '90 days'
  )
  SELECT jsonb_build_object(
    'avg_speed_rows_per_sec', COALESCE(AVG(speed_rows_per_sec),0),
    'fastest_import_ms', COALESCE(MIN(EXTRACT(EPOCH FROM (finished_at - started_at))*1000) FILTER (WHERE finished_at IS NOT NULL),0),
    'slowest_import_ms', COALESCE(MAX(EXTRACT(EPOCH FROM (finished_at - started_at))*1000) FILTER (WHERE finished_at IS NOT NULL),0),
    'largest_import', COALESCE(MAX(total_rows),0),
    'avg_ai_fixes', COALESCE(AVG(cleaned_rows),0),
    'duplicate_rate', CASE WHEN SUM(total_rows) > 0 THEN ROUND(SUM(duplicate_rows)::numeric / SUM(total_rows) * 100, 2) ELSE 0 END,
    'avg_processing_time_ms', COALESCE(AVG(EXTRACT(EPOCH FROM (finished_at - started_at))*1000) FILTER (WHERE finished_at IS NOT NULL),0),
    'avg_queue_wait_ms', COALESCE(AVG(queue_wait_ms),0)
  ) INTO v FROM runs;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_learning_suggestion(
  p_project_id uuid, p_kind text, p_input text, p_suggested text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.import_learning_suggestions(project_id, kind, input_value, suggested_value)
  VALUES (p_project_id, p_kind, p_input, p_suggested)
  ON CONFLICT (project_id, kind, input_value, suggested_value)
  DO UPDATE SET confirmations = public.import_learning_suggestions.confirmations + 1,
                last_seen_at = now(),
                updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_learning_suggestion(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.import_learning_suggestions WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.import_learning_suggestions
    SET status = 'approved', promoted_at = now(), updated_at = now()
    WHERE id = p_id;

  IF r.kind = 'product_alias' THEN
    INSERT INTO public.product_aliases(project_id, alias, canonical_name, source)
    VALUES (r.project_id, r.input_value, r.suggested_value, 'learned')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_learning(p_project_id uuid, p_kind text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.import_learning_suggestions
    WHERE project_id = p_project_id
      AND (p_kind IS NULL OR kind = p_kind)
      AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_queue;

-- updated_at triggers
CREATE TRIGGER trg_import_queue_updated BEFORE UPDATE ON public.import_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_batches_updated BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_learn_updated BEFORE UPDATE ON public.import_learning_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_errors_updated BEFORE UPDATE ON public.import_errors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
