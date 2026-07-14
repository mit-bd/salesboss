import { useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useImportRecovery } from "@/hooks/useImportRecovery";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, PlayCircle, XCircle, RotateCcw, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ImportErrorCenter from "@/components/import/ImportErrorCenter";
import ImportPerformancePanel from "@/components/import/ImportPerformancePanel";

const TABS = ["all", "running", "completed", "paused", "failed", "cancelled"] as const;

function fmtDate(v: string | null) { return v ? new Date(v).toLocaleString() : "—"; }
function fmtDur(a: string | null, b: string | null) {
  if (!a || !b) return "—";
  const s = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export default function ImportRecoveryPage() {
  const { runs, loading, resume, cancel, retryFailed } = useImportRecovery();
  const { toast } = useToast();
  const [tab, setTab] = useState<typeof TABS[number]>("all");

  const filtered = useMemo(() => {
    if (tab === "all") return runs;
    if (tab === "running") return runs.filter(r => ["processing", "running", "resumable"].includes(r.status));
    return runs.filter(r => r.status === tab);
  }, [runs, tab]);

  const act = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); toast({ title: ok }); }
    catch (e) { toast({ title: "Failed", description: (e as Error).message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <PageHeader title="Import Recovery" description="Resume, retry, or cancel background imports" />
      <div className="p-4 md:p-6 space-y-4">
        <ImportPerformancePanel />
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            {TABS.map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports in this state.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.id.slice(0, 8)}</code>
                            <Badge variant="outline" className="capitalize">{r.status}</Badge>
                            {r.courier_name && <Badge variant="secondary">{r.courier_name}</Badge>}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                            <div><span className="block text-[10px] uppercase">Rows</span><span className="font-mono text-foreground">{r.total_rows ?? 0}</span></div>
                            <div><span className="block text-[10px] uppercase">Batches</span><span className="font-mono text-foreground">{r.processed_batches ?? 0}/{r.total_batches ?? 0}</span></div>
                            <div><span className="block text-[10px] uppercase">Speed</span><span className="font-mono text-foreground">{Number(r.speed_rows_per_sec ?? 0).toFixed(1)} r/s</span></div>
                            <div><span className="block text-[10px] uppercase">Started</span><span className="text-foreground">{fmtDate(r.started_at)}</span></div>
                            <div><span className="block text-[10px] uppercase">Duration</span><span className="text-foreground">{fmtDur(r.started_at, r.finished_at)}</span></div>
                            <div><span className="block text-[10px] uppercase">Device</span><span className="text-foreground">{r.device ?? "—"}</span></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button size="sm" variant="outline"><FileText className="h-4 w-4" />Logs</Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-full sm:max-w-lg">
                              <SheetHeader><SheetTitle>Errors · {r.id.slice(0, 8)}</SheetTitle></SheetHeader>
                              <div className="mt-4"><ImportErrorCenter runId={r.id} /></div>
                            </SheetContent>
                          </Sheet>
                          {["paused", "resumable", "failed_partial", "failed"].includes(r.status) && (
                            <Button size="sm" onClick={() => act(() => resume(r.id), "Import resumed")}>
                              <PlayCircle className="h-4 w-4" />Resume
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => act(() => retryFailed(r.id), "Failed batches requeued")}>
                            <RotateCcw className="h-4 w-4" />Retry Failed
                          </Button>
                          {!["completed", "cancelled"].includes(r.status) && (
                            <Button size="sm" variant="ghost" onClick={() => act(() => cancel(r.id), "Import cancelled")}>
                              <XCircle className="h-4 w-4" />Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
