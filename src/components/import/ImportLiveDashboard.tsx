import { useMemo } from "react";
import { useImportLive } from "@/hooks/useImportLive";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ImportErrorCenter from "./ImportErrorCenter";

interface Props { runId: string }

export default function ImportLiveDashboard({ runId }: Props) {
  const { run, batches, refresh, kickWorker } = useImportLive(runId);

  const stats = useMemo(() => {
    const done = batches.filter((b) => b.status === "completed").length;
    const running = batches.filter((b) => b.status === "running").length;
    const queued = batches.filter((b) => b.status === "queued").length;
    const failed = batches.filter((b) => b.status === "failed").length;
    const total = batches.length || (run?.total_batches ?? 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const rowsDone = done * 300; // best-effort visual estimate against chunk_size
    const speed = Number(run?.speed_rows_per_sec ?? 0);
    const remainingBatches = Math.max(total - done, 0);
    const etaSec = speed > 0 ? Math.round((remainingBatches * 300) / speed) : null;
    return { done, running, queued, failed, total, pct, rowsDone, speed, etaSec };
  }, [batches, run]);

  const retryFailed = async () => {
    await supabase.rpc("retry_failed_batches", { p_run_id: runId });
    await kickWorker();
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 card-shadow space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-base">Live Import Progress</h3>
            <p className="text-xs text-muted-foreground">
              {run?.source_filename} · Mode: <span className="uppercase">{run?.import_mode ?? "quick"}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={run?.status === "completed" ? "default" : "secondary"} className="uppercase text-[10px]">
              {run?.status ?? "…"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => { kickWorker(); refresh(); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Kick worker
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Progress value={stats.pct} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.done} / {stats.total} chunks · {stats.pct}%</span>
            <span>
              {stats.speed > 0 ? `${stats.speed.toFixed(1)} rows/s` : "—"}
              {stats.etaSec !== null && stats.etaSec > 0 ? ` · ETA ${formatEta(stats.etaSec)}` : ""}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-xs">
          <Tile icon={<Clock className="h-4 w-4" />} label="Queued" value={stats.queued} tone="muted" />
          <Tile icon={<Loader2 className="h-4 w-4 animate-spin" />} label="Running" value={stats.running} tone="info" />
          <Tile icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={stats.done} tone="success" />
          <Tile icon={<AlertCircle className="h-4 w-4" />} label="Failed" value={stats.failed} tone="danger" />
        </div>

        {stats.failed > 0 && (
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs">
              {stats.failed} chunks exhausted their retry budget. Fix source data or requeue them.
            </p>
            <Button size="sm" variant="destructive" onClick={retryFailed}>Retry failed</Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 card-shadow">
        <h4 className="text-sm font-semibold mb-3">Errors</h4>
        <ImportErrorCenter runId={runId} />
      </div>
    </div>
  );
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "muted"|"info"|"success"|"danger" }) {
  const toneClass = {
    muted: "text-muted-foreground",
    info: "text-blue-600 dark:text-blue-400",
    success: "text-emerald-600 dark:text-emerald-400",
    danger: "text-red-600 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-lg border border-border p-3 flex items-center gap-2.5">
      <span className={toneClass}>{icon}</span>
      <div>
        <div className="text-lg font-semibold leading-none">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function formatEta(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
