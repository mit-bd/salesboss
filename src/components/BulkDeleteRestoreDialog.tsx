import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";

export type BulkDeleteRestoreMode = "delete" | "restore";
export type BulkPhase = "idle" | "preparing" | "processing" | "recalculating" | "refreshing" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: BulkDeleteRestoreMode;
  count: number;
  phase: BulkPhase;
  progress?: number; // 0-100
  onConfirm: (reason: string) => Promise<void> | void;
}

const PHASE_LABEL: Record<BulkPhase, string> = {
  idle: "",
  preparing: "Preparing…",
  processing: "Processing orders…",
  recalculating: "Updating customers…",
  refreshing: "Refreshing statistics…",
  done: "Completed",
};

export default function BulkDeleteRestoreDialog({ open, onOpenChange, mode, count, phase, progress = 0, onConfirm }: Props) {
  const isDelete = mode === "delete";
  const expected = isDelete ? "DELETE" : "RESTORE";
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const busy = phase !== "idle" && phase !== "done";

  useEffect(() => {
    if (!open) { setText(""); setReason(""); }
  }, [open]);

  const canRun = text.trim().toUpperCase() === expected && !busy && count > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isDelete ? "text-destructive" : "text-primary"}`}>
            {isDelete ? <AlertTriangle className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
            {isDelete ? "Bulk Delete Orders" : "Bulk Restore Orders"}
          </DialogTitle>
          <DialogDescription>
            You are about to {isDelete ? "delete" : "restore"}:
          </DialogDescription>
        </DialogHeader>

        <div className={`rounded-lg border p-4 text-center ${isDelete ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
          <div className="text-3xl font-bold">{count.toLocaleString("en-BD")}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {count === 1 ? "Order" : "Orders"} — {isDelete ? "this can be restored later from Deleted Orders." : "they will return to active operations."}
          </div>
        </div>

        {isDelete && !busy && (
          <div className="space-y-2">
            <Label htmlFor="bulk-reason" className="text-xs">Reason (optional)</Label>
            <Textarea id="bulk-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bulk Delete" className="text-sm" />
          </div>
        )}

        {!busy && (
          <div className="space-y-2">
            <Label htmlFor="bulk-confirm" className="text-xs">
              Type <span className={`font-mono font-semibold ${isDelete ? "text-destructive" : "text-primary"}`}>{expected}</span> to confirm
            </Label>
            <Input id="bulk-confirm" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder={expected} className="font-mono" />
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
              variant={isDelete ? "destructive" : "default"}
              disabled={!canRun}
              className="gap-1.5"
              onClick={() => onConfirm(reason.trim() || (isDelete ? "Bulk Delete" : ""))}
            >
              {isDelete ? <Trash2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              {isDelete ? "Bulk Delete" : "Bulk Restore"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
