
-- 1. Operational log table
CREATE TABLE IF NOT EXISTS public.followup_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  advanced_count integer NOT NULL DEFAULT 0,
  reminder_count integer NOT NULL DEFAULT 0,
  due_now_count integer NOT NULL DEFAULT 0,
  skipped_locked boolean NOT NULL DEFAULT false,
  error_message text
);

GRANT SELECT ON public.followup_automation_runs TO authenticated;
GRANT ALL ON public.followup_automation_runs TO service_role;

ALTER TABLE public.followup_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/owners can view automation runs"
  ON public.followup_automation_runs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
  );

-- 2. Retention: keep only last 7 days of run rows
CREATE OR REPLACE FUNCTION public.prune_followup_automation_runs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.followup_automation_runs
  WHERE started_at < now() - interval '7 days';
$$;

-- 3. Advance function — respects exact datetime when present
CREATE OR REPLACE FUNCTION public.advance_followup_steps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_count integer := 0;
BEGIN
  UPDATE public.orders o
  SET
    followup_step = o.followup_step + 1,
    current_status = 'pending',
    followup_date = (
      SELECT fh.next_followup_date
      FROM public.followup_history fh
      WHERE fh.order_id = o.id AND fh.step_number = o.followup_step
      ORDER BY fh.completed_at DESC LIMIT 1
    ),
    next_followup_datetime = NULL,
    updated_at = now()
  WHERE
    o.is_deleted = false
    AND o.current_status = 'completed'
    AND o.followup_step < 5
    AND EXISTS (
      SELECT 1 FROM public.followup_history fh
      WHERE fh.order_id = o.id
        AND fh.step_number = o.followup_step
        AND fh.next_followup_date IS NOT NULL
        AND (
          -- exact datetime path (most accurate)
          (o.next_followup_datetime IS NOT NULL AND o.next_followup_datetime <= now())
          OR
          -- date-only path: due at start of that day in Bangladesh time (BST is UTC+6, no DST)
          (o.next_followup_datetime IS NULL
            AND fh.next_followup_date <= (now() AT TIME ZONE 'Asia/Dhaka')::date)
        )
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

-- 4. Full automation routine: idempotent, concurrency-safe, per-project safe
CREATE OR REPLACE FUNCTION public.run_followup_automation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_run_id uuid;
  v_advanced integer := 0;
  v_reminders integer := 0;
  v_due_now integer := 0;
  v_lock boolean;
  v_err text;
BEGIN
  -- Advisory lock: only one automation run at a time
  v_lock := pg_try_advisory_lock(hashtext('followup_automation_singleton')::bigint);
  IF NOT v_lock THEN
    INSERT INTO public.followup_automation_runs (finished_at, skipped_locked)
    VALUES (now(), true);
    RETURN jsonb_build_object('skipped', true, 'reason', 'locked');
  END IF;

  INSERT INTO public.followup_automation_runs DEFAULT VALUES
  RETURNING id INTO v_run_id;

  BEGIN
    -- (a) Advance due followups
    v_advanced := public.advance_followup_steps();

    -- (b) Insert step-transition notifications (assigned executive + project admins).
    -- Idempotent via NOT EXISTS check that dedupes per order + step + type.
    WITH advanced AS (
      SELECT id, invoice_id, customer_name, followup_step, assigned_to, project_id
      FROM public.orders
      WHERE is_deleted = false
        AND current_status = 'pending'
        AND updated_at >= now() - interval '2 minutes'
    ),
    targets AS (
      -- assigned executive
      SELECT a.id AS order_id, a.project_id, a.followup_step, a.invoice_id, a.customer_name,
             a.assigned_to AS user_id
      FROM advanced a
      WHERE a.assigned_to IS NOT NULL
      UNION
      -- project admins (excluding assigned to avoid double)
      SELECT a.id, a.project_id, a.followup_step, a.invoice_id, a.customer_name,
             ur.user_id
      FROM advanced a
      JOIN public.user_roles ur ON ur.role = 'admin'::app_role
      JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE p.project_id = a.project_id
        AND (a.assigned_to IS NULL OR ur.user_id <> a.assigned_to)
    )
    INSERT INTO public.notifications (user_id, project_id, type, title, message, order_id)
    SELECT t.user_id, t.project_id, 'followup_due',
           'Followup Due',
           'Followup Step ' || t.followup_step || ' due for ' || t.customer_name || ' (' || t.invoice_id || ')',
           t.order_id
    FROM targets t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.order_id = t.order_id
        AND n.user_id = t.user_id
        AND n.type = 'followup_due'
        AND n.message LIKE 'Followup Step ' || t.followup_step || '%'
    );

    -- (c) 10-minute-ahead reminders (dedupe per order, 15-min window)
    WITH upcoming AS (
      SELECT id, invoice_id, customer_name, followup_step, assigned_to, project_id,
             next_followup_datetime
      FROM public.orders
      WHERE is_deleted = false
        AND current_status = 'pending'
        AND assigned_to IS NOT NULL
        AND next_followup_datetime IS NOT NULL
        AND next_followup_datetime > now()
        AND next_followup_datetime <= now() + interval '10 minutes'
    )
    INSERT INTO public.notifications (user_id, project_id, type, title, message, order_id)
    SELECT u.assigned_to, u.project_id, 'followup_reminder',
           'Upcoming Followup',
           '⏰ Followup soon — ' || u.customer_name || ' (' || u.invoice_id || ')',
           u.id
    FROM upcoming u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.order_id = u.id
        AND n.type = 'followup_reminder'
        AND n.created_at >= now() - interval '15 minutes'
    );
    GET DIAGNOSTICS v_reminders = ROW_COUNT;

    -- (d) Due-now notifications (dedupe per order, 10-min window)
    WITH duenow AS (
      SELECT id, invoice_id, customer_name, followup_step, assigned_to, project_id
      FROM public.orders
      WHERE is_deleted = false
        AND current_status = 'pending'
        AND assigned_to IS NOT NULL
        AND next_followup_datetime IS NOT NULL
        AND next_followup_datetime <= now()
        AND next_followup_datetime >= now() - interval '5 minutes'
    )
    INSERT INTO public.notifications (user_id, project_id, type, title, message, order_id)
    SELECT d.assigned_to, d.project_id, 'followup_now',
           'Call Customer Now',
           '📞 Followup Step ' || d.followup_step || ' for ' || d.customer_name || ' is due NOW (' || d.invoice_id || ')',
           d.id
    FROM duenow d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.order_id = d.id
        AND n.type = 'followup_now'
        AND n.created_at >= now() - interval '10 minutes'
    );
    GET DIAGNOSTICS v_due_now = ROW_COUNT;

    UPDATE public.followup_automation_runs
    SET finished_at = now(),
        advanced_count = v_advanced,
        reminder_count = v_reminders,
        due_now_count = v_due_now
    WHERE id = v_run_id;

  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    UPDATE public.followup_automation_runs
    SET finished_at = now(),
        advanced_count = v_advanced,
        reminder_count = v_reminders,
        due_now_count = v_due_now,
        error_message = left(v_err, 500)
    WHERE id = v_run_id;
  END;

  PERFORM pg_advisory_unlock(hashtext('followup_automation_singleton')::bigint);

  -- Best-effort retention prune (cheap, once per minute)
  PERFORM public.prune_followup_automation_runs();

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'advanced', v_advanced,
    'reminders', v_reminders,
    'due_now', v_due_now,
    'error', v_err
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_followup_automation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_followup_automation() TO service_role;

-- 5. Schedule cron job (idempotent: unschedule prior job with same name if present)
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'followup-automation';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'followup-automation',
    '* * * * *',
    $cron$ SELECT public.run_followup_automation(); $cron$
  );
END $$;
