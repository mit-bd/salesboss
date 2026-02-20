import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrderStore } from "@/contexts/OrderStoreContext";

interface BulkCompleteFollowupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  activeStep: number;
  onComplete: () => void;
}

export default function BulkCompleteFollowupDialog({
  open, onOpenChange, selectedIds, activeStep, onComplete,
}: BulkCompleteFollowupDialogProps) {
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const { addLog } = useAuditLog();
  const { user, profile, role } = useAuth();
  const { refreshOrders } = useOrderStore();

  const count = selectedIds.size;
  const isFinalStep = activeStep === 5;

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

    try {
      const ids = Array.from(selectedIds);
      const userName = profile?.full_name || "Admin User";

      // Insert followup history for each order individually
      const historyRows = ids.map((orderId) => ({
        order_id: orderId,
        step_number: activeStep,
        note: note.trim(),
        problems_discussed: "",
        upsell_attempted: false,
        upsell_details: "",
        next_followup_date: isFinalStep ? null : nextDate,
        completed_by: user?.id || null,
        completed_by_name: userName,
      }));

      const { error: historyError } = await supabase
        .from("followup_history")
        .insert(historyRows);

      if (historyError) throw historyError;

      // Update all orders to completed status
      const updatePayload: Record<string, any> = {
        current_status: "completed",
        followup_date: isFinalStep ? null : nextDate,
      };
      if (isFinalStep) updatePayload.health = "good";

      const { error: orderError } = await supabase
        .from("orders")
        .update(updatePayload)
        .in("id", ids);

      if (orderError) throw orderError;

      await refreshOrders();

      addLog({
        actionType: "Bulk Followup Completed",
        userName,
        role: role || "unknown",
        entity: `${count} orders`,
        details: `Step ${activeStep} completed${isFinalStep ? " (final)" : `, next: ${nextDate}`}`,
      });

      toast({ title: "Bulk Followup Complete", description: `${count} order(s) marked as completed for Step ${activeStep}.` });

      setNote("");
      setNextDate("");
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[BulkCompleteFollowup] Error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Bulk Complete — Step {activeStep}
          </DialogTitle>
        </DialogHeader>

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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
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
