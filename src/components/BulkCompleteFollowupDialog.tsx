import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useBulkConflict } from "@/hooks/useBulkConflict";

interface BulkCompleteFollowupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  activeStep: number;
  onComplete: () => void;
  onConflict?: (conflictIds: Set<string>) => void;
}

export default function BulkCompleteFollowupDialog({
  open, onOpenChange, selectedIds, activeStep, onComplete, onConflict,
}: BulkCompleteFollowupDialogProps) {
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const { addLog } = useAuditLog();
  const { user, profile, role } = useAuth();
  const { refreshOrders } = useOrderStore();
  const { buildVersionMap, handleConflictResponse, conflict, clearConflict } = useBulkConflict();

  const count = selectedIds.size;
  const isFinalStep = activeStep === 5;

  const handleReload = async () => {
    clearConflict();
    await refreshOrders();
    toast({ title: "Data Reloaded", description: "Latest order data has been fetched." });
  };

  const handleSubmit = async () => {
    if (!note.trim()) {
      toast({ title: "Note required", description: "Please add a followup note.", variant: "destructive" });
      return;
    }
    if (!isFinalStep && !nextDate) {
      toast({ title: "Date required", description: "Please set the next followup date.", variant: "destructive" });
      return;
    }

    setConfirmOpen(false);
    setSaving(true);
    clearConflict();

    try {
      const ids = Array.from(selectedIds);
      const versions = buildVersionMap(ids);
      const userName = profile?.full_name || "Admin User";

      // Use version-checked atomic bulk followup completion
      const { data: result, error } = await supabase.rpc("bulk_complete_followups_with_lock", {
        p_order_ids: ids,
        p_versions: versions,
        p_step_number: activeStep,
        p_note: note.trim(),
        p_next_followup_date: isFinalStep ? null : nextDate,
        p_completed_by: user?.id || null,
        p_completed_by_name: userName,
      });

      if (error) {
        console.error("[BulkCompleteFollowup] Atomic transaction failed:", error);
        throw error;
      }

      // Check for conflicts
      if (handleConflictResponse(result as any)) {
        const conflictResult = result as any;
        addLog({
          actionType: "Bulk Followup Failed",
          userName,
          role: role || "unknown",
          entity: `${count} orders`,
          details: `Conflict on ${conflictResult.conflict_ids.length} record(s). Batch aborted.`,
        });
        onConflict?.(new Set(conflictResult.conflict_ids));
        toast({
          title: "Conflict Detected",
          description: "Some records were modified by another user. Entire batch aborted.",
          variant: "destructive",
        });
        return;
      }

      const successResult = result as any;
      console.info(`[BulkCompleteFollowup] Atomically completed ${successResult.affected_count} orders at step ${activeStep}`);
      await refreshOrders();

      addLog({
        actionType: "Bulk Followup Completed",
        userName,
        role: role || "unknown",
        entity: `${count} orders`,
        details: `Step ${activeStep} completed${isFinalStep ? " (final)" : `, next: ${nextDate}`}`,
      });

      toast({ title: "Bulk Followup Complete", description: `${successResult.affected_count} order(s) marked as completed for Step ${activeStep}.` });

      setNote("");
      setNextDate("");
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[BulkCompleteFollowup] Error:", err);
      if (!conflict.hasConflict) {
        toast({ title: "Error", description: err.message + ". No records were modified.", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) clearConflict(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Bulk Complete — Step {activeStep}
          </DialogTitle>
        </DialogHeader>

        {/* Conflict Banner */}
        {conflict.hasConflict && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Conflict Detected</p>
                <p className="text-xs text-muted-foreground mt-0.5">{conflict.message}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={handleReload}>
              <RefreshCw className="h-3 w-3" /> Reload Data
            </Button>
          </div>
        )}

        <div className="rounded-lg bg-muted/50 p-3 mb-3">
          <p className="text-sm font-medium">{count} order{count !== 1 ? "s" : ""} will be marked as completed</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Followup Note *</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for all selected orders..."
              rows={3}
              className="mt-1"
            />
          </div>

          {!isFinalStep && (
            <div>
              <Label className="text-xs">Next Followup Date *</Label>
              <Input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="mt-1"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          )}

          {isFinalStep && (
            <p className="text-xs text-muted-foreground bg-success/10 text-success rounded-lg p-2">
              This is the final step. Orders will be marked as fully completed.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-2">
          <Button variant="outline" onClick={() => { clearConflict(); onOpenChange(false); }} disabled={saving}>Cancel</Button>
          {!confirmOpen ? (
            <Button onClick={() => setConfirmOpen(true)} disabled={!note.trim() || (!isFinalStep && !nextDate) || saving}>
              Complete {count} Order{count !== 1 ? "s" : ""}
            </Button>
          ) : (
            <div className="flex items-center gap-2 animate-fade-in">
              <div className="flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
              </div>
              <Button variant="destructive" size="sm" onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)} disabled={saving}>No</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
