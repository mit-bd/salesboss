import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, FileSpreadsheet, FileJson, FileText, Trash2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

export type HardDeletePhase =
  | "idle" | "preparing" | "checking" | "exporting" | "deleting" | "recalculating" | "done";

interface OrderRow {
  id: string;
  generatedOrderId?: string | null;
  invoiceId?: string | null;
  customerName?: string | null;
  mobile?: string | null;
  price?: number | null;
  orderDate?: string | null;
  currentStatus?: string | null;
}

interface Deps {
  orders: number;
  customers: number;
  followups: number;
  activity_logs: number;
  notifications: number;
  repeat_records: number;
  commission_entries: number;
  memory_events: number;
  child_orders: number;
  has_dependencies: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrders: OrderRow[]; // metadata for export + summary
  phase: HardDeletePhase;
  progress: number; // 0-100
  onConfirm: (reason: string) => Promise<void> | void;
}

const PHRASE = "DELETE FOREVER";

const PHASE_LABEL: Record<HardDeletePhase, string> = {
  idle: "",
  preparing: "Preparing…",
  checking: "Checking dependencies…",
  exporting: "Exporting backup…",
  deleting: "Deleting orders…",
  recalculating: "Updating statistics…",
  done: "Completed",
};

export default function BulkHardDeleteDialog({
  open, onOpenChange, selectedOrders, phase, progress, onConfirm,
}: Props) {
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [deps, setDeps] = useState<Deps | null>(null);
  const [depsError, setDepsError] = useState<string | null>(null);
  const [depsLoading, setDepsLoading] = useState(false);
  const busy = phase !== "idle" && phase !== "done";

  const ids = useMemo(() => selectedOrders.map((o) => o.id), [selectedOrders]);
  const customerCount = useMemo(() => {
    const s = new Set(selectedOrders.map((o) => o.mobile || o.customerName || o.id));
    return s.size;
  }, [selectedOrders]);

  useEffect(() => {
    if (!open) { setText(""); setReason(""); setDeps(null); setDepsError(null); return; }
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      setDepsLoading(true);
      setDepsError(null);
      const { data, error } = await supabase.rpc("check_hard_delete_dependencies", { p_order_ids: ids });
      if (cancelled) return;
      if (error) setDepsError(error.message);
      else setDeps(data as unknown as Deps);
      setDepsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, ids]);

  const canRun = text.trim().toUpperCase() === PHRASE && !busy && ids.length > 0;

  const exportRows = () =>
    selectedOrders.map((o) => ({
      order_id: o.generatedOrderId || o.invoiceId || o.id,
      internal_id: o.id,
      customer_name: o.customerName || "",
      mobile: o.mobile || "",
      status: o.currentStatus || "",
      price: Number(o.price || 0),
      order_date: o.orderDate || "",
    }));

  const downloadBlob = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const exportCsv = () => {
    const rows = exportRows();
    const headers = Object.keys(rows[0] || { order_id: "" });
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => JSON.stringify((r as any)[h] ?? "")).join(",")),
    ].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), `deleted-orders-backup-${stamp}.csv`);
  };

  const exportJson = () => {
    downloadBlob(
      new Blob([JSON.stringify(exportRows(), null, 2)], { type: "application/json" }),
      `deleted-orders-backup-${stamp}.json`
    );
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deleted Orders");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `deleted-orders-backup-${stamp}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Permanently Delete Orders
          </DialogTitle>
          <DialogDescription>
            This action is <span className="font-semibold text-destructive">irreversible</span>.
            Deleted rows cannot be restored.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold">{ids.length.toLocaleString("en-BD")}</div>
              <div className="text-xs text-muted-foreground">Orders selected</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{customerCount.toLocaleString("en-BD")}</div>
              <div className="text-xs text-muted-foreground">Customers affected</div>
            </div>
          </div>
        </div>

        {depsLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking related records…
          </div>
        )}

        {depsError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Dependency check failed</AlertTitle>
            <AlertDescription className="text-xs">{depsError}</AlertDescription>
          </Alert>
        )}

        {deps && deps.has_dependencies && !busy && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Related business data will be lost</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                {deps.followups > 0 && <li>Followups: <b>{deps.followups}</b></li>}
                {deps.activity_logs > 0 && <li>Activity logs: <b>{deps.activity_logs}</b></li>}
                {deps.notifications > 0 && <li>Notifications: <b>{deps.notifications}</b></li>}
                {deps.repeat_records > 0 && <li>Repeat records: <b>{deps.repeat_records}</b></li>}
                {deps.commission_entries > 0 && <li>Commission entries: <b>{deps.commission_entries}</b> (unlinked)</li>}
                {deps.memory_events > 0 && <li>AI memory: <b>{deps.memory_events}</b> (unlinked)</li>}
                {deps.child_orders > 0 && <li>Child orders: <b>{deps.child_orders}</b> (detached)</li>}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {!busy && (
          <div className="space-y-2">
            <Label className="text-xs">Backup before delete (optional)</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportXlsx} disabled={ids.length === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={ids.length === 0}>
                <FileText className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportJson} disabled={ids.length === 0}>
                <FileJson className="h-3.5 w-3.5" /> JSON
              </Button>
            </div>
          </div>
        )}

        {!busy && (
          <div className="space-y-2">
            <Label htmlFor="hard-reason" className="text-xs">Reason (optional)</Label>
            <Textarea id="hard-reason" rows={2} maxLength={500} value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. GDPR request, duplicate cleanup…" className="text-sm" />
          </div>
        )}

        {!busy && (
          <div className="space-y-2">
            <Label htmlFor="hard-confirm" className="text-xs">
              Type <span className="font-mono font-semibold text-destructive">{PHRASE}</span> to enable delete
            </Label>
            <Input id="hard-confirm" autoComplete="off" value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PHRASE} className="font-mono" />
          </div>
        )}

        {busy && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{PHASE_LABEL[phase]}</span>
              <span className="font-mono text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {phase === "done" ? "Close" : "Cancel"}
          </Button>
          {phase !== "done" && (
            <Button
              variant="destructive"
              disabled={!canRun}
              className="gap-1.5"
              onClick={() => onConfirm(reason.trim())}
            >
              <Trash2 className="h-4 w-4" /> Delete Forever
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
