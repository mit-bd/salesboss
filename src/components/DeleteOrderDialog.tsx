import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Order } from "@/types/data";

interface DeleteOrderDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: (reason: string) => void | Promise<void>;
  childCount?: number;
}

export default function DeleteOrderDialog({
  order,
  open,
  onOpenChange,
  onConfirm,
  childCount = 0,
}: DeleteOrderDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  const canDelete = confirmText.trim().toUpperCase() === "DELETE" && !submitting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setSubmitting(true);
    try {
      await onConfirm?.(reason.trim());
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const displayId = order.generatedOrderId || order.invoiceId || order.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Delete Order
          </DialogTitle>
          <DialogDescription>
            This action will remove the order from active operations. It will remain
            available in <strong>Deleted Orders</strong> for restoration by an Admin or Owner.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1.5 text-sm">
          <Row label="Order ID" value={displayId} mono />
          <Row label="Customer" value={order.customerName} />
          <Row label="Phone" value={order.mobile} mono />
          <Row label="COD Amount" value={`৳${Number(order.price || 0).toLocaleString("en-BD")}`} />
          <Row label="Current Status" value={order.currentStatus || "pending"} />
          {childCount > 0 && (
            <Row label="Child orders" value={`${childCount} will also be deleted`} highlight />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="delete-reason" className="text-xs">Reason (optional)</Label>
          <Textarea
            id="delete-reason"
            placeholder="Why is this order being deleted?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="delete-confirm" className="text-xs">
            Type <span className="font-mono font-semibold text-destructive">DELETE</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="font-mono"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            {submitting ? "Deleting…" : "Delete Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${highlight ? "text-warning font-medium" : "text-foreground font-medium"} truncate`}>
        {value}
      </span>
    </div>
  );
}
