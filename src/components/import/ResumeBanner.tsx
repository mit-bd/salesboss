import { AlertCircle, PlayCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useResumeBanner } from "@/hooks/useResumeBanner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ResumeBanner() {
  const run = useResumeBanner();
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (!run) return null;
  const total = run.total_rows ?? 0;
  const processed = (run.processed_batches ?? 0) * 200;
  const remaining = Math.max(total - processed, 0);
  const speed = run.speed_rows_per_sec ?? 0;
  const eta = speed > 0 ? Math.round(remaining / speed) : null;

  const handleResume = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("import-resume", { body: { import_run_id: run.id } });
    setBusy(false);
    if (error) {
      toast({ title: "Resume failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Resumed", description: "Background worker will continue from the last processed row." });
    }
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-sm">Previous import can be resumed</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground mt-2">
            <div><span className="block text-[10px] uppercase">Last Row</span><span className="font-mono text-foreground">{processed.toLocaleString()}</span></div>
            <div><span className="block text-[10px] uppercase">Remaining</span><span className="font-mono text-foreground">{remaining.toLocaleString()}</span></div>
            <div><span className="block text-[10px] uppercase">ETA</span><span className="font-mono text-foreground">{eta ? `${eta}s` : "—"}</span></div>
            <div><span className="block text-[10px] uppercase">Batch</span><span className="font-mono text-foreground">{run.processed_batches ?? 0}/{run.total_batches ?? 0}</span></div>
            <div><span className="block text-[10px] uppercase">Token</span><span className="font-mono text-foreground truncate block">{run.id.slice(0, 8)}</span></div>
            <div><span className="block text-[10px] uppercase">Resumed By</span><span className="text-foreground">{run.resumed_by ?? "—"}</span></div>
            <div><span className="block text-[10px] uppercase">Resumed At</span><span className="text-foreground">{run.resumed_at ? new Date(run.resumed_at).toLocaleString() : "—"}</span></div>
            <div><span className="block text-[10px] uppercase">Status</span><span className="text-foreground capitalize">{run.status}</span></div>
          </div>
        </div>
        <Button onClick={handleResume} disabled={busy} size="sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Resume
        </Button>
      </div>
    </Card>
  );
}
