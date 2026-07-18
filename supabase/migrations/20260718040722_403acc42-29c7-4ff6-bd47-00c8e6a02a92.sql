
-- Sync missing columns on import_runs used by application code and RPCs
ALTER TABLE public.import_runs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cleaned_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Backfill started_at from created_at for existing rows
UPDATE public.import_runs SET started_at = created_at WHERE started_at IS NULL OR started_at = now();

-- Ensure updated_at trigger
DROP TRIGGER IF EXISTS trg_import_runs_updated ON public.import_runs;
CREATE TRIGGER trg_import_runs_updated
BEFORE UPDATE ON public.import_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_import_runs_project_started ON public.import_runs (project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_runs_status ON public.import_runs (status);

-- Ask PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
