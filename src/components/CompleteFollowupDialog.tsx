import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle } from "lucide-react";
import { Order } from "@/types/data";

interface CompleteFollowupDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: {
    orderId: string;
    stepNumber: number;
    note: string;
    problemsDiscussed: string;
    upsellAttempted: boolean;
    upsellDetails: string;
    nextFollowupDate: string | null;
  }) => Promise<void>;
}

export default function CompleteFollowupDialog({
  order,
  open,
  onOpenChange,
  onComplete,
}: CompleteFollowupDialogProps) {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState("");
  const [upsellAttempted, setUpsellAttempted] = useState(false);
  const [upsellDetails, setUpsellDetails] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [error, setError] = useState("");

  const isFinalStep = order.followupStep === 5;

  const handleSubmit = async () => {
    if (!isFinalStep && !nextDate) {
      setError("Next followup date is required");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onComplete({
        orderId: order.id,
        stepNumber: order.followupStep,
        note,
        problemsDiscussed: problems,
        upsellAttempted,
        upsellDetails: upsellAttempted ? upsellDetails : "",
        nextFollowupDate: isFinalStep ? null : nextDate,
      });
      // Reset form
      setNote("");
      setProblems("");
      setUpsellAttempted(false);
      setUpsellDetails("");
      setNextDate("");
      onOpenChange(false);
    } catch {
      // Error handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Complete Step {order.followupStep} Followup
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">{order.customerName}</p>
            <p className="text-xs text-muted-foreground">{order.productTitle} · ৳{order.price}</p>
          </div>

          <div>
            <Label className="text-xs">Followup Summary Note *</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was discussed during this followup..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label className="text-xs">Problems Discussed</Label>
            <Textarea
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
              placeholder="Any issues or concerns raised..."
              className="mt-1"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="upsell"
              checked={upsellAttempted}
              onCheckedChange={(checked) => setUpsellAttempted(!!checked)}
            />
            <Label htmlFor="upsell" className="text-xs cursor-pointer">Upsell attempted</Label>
          </div>

          {upsellAttempted && (
            <div>
              <Label className="text-xs">Upsell Details</Label>
              <Input
                value={upsellDetails}
                onChange={(e) => setUpsellDetails(e.target.value)}
                placeholder="What was offered..."
                className="mt-1"
              />
            </div>
          )}

          {!isFinalStep && (
            <div>
              <Label className="text-xs">Next Followup Date *</Label>
              <Input
                type="date"
                value={nextDate}
                onChange={(e) => { setNextDate(e.target.value); setError(""); }}
                className="mt-1"
                min={new Date().toISOString().split("T")[0]}
              />
              {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            </div>
          )}

          {isFinalStep && (
            <div className="rounded-lg bg-success/10 p-3">
              <p className="text-xs font-medium text-success">
                This is the final step. Completing this will mark the order's followup lifecycle as fully completed.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Step {order.followupStep}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
