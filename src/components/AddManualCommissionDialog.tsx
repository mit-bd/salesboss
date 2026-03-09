import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Executive {
  userId: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  executives: Executive[];
  onSave: (data: { executive_id: string; amount: number; order_invoice: string; payment_note: string }) => Promise<void>;
}

export default function AddManualCommissionDialog({ open, onOpenChange, executives, onSave }: Props) {
  const [execId, setExecId] = useState("");
  const [amount, setAmount] = useState(0);
  const [invoice, setInvoice] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!execId || amount <= 0) return;
    setSaving(true);
    try {
      await onSave({ executive_id: execId, amount, order_invoice: invoice, payment_note: note });
      setExecId("");
      setAmount(0);
      setInvoice("");
      setNote("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Manual Commission</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Executive</Label>
            <Select value={execId} onValueChange={setExecId}>
              <SelectTrigger><SelectValue placeholder="Select executive" /></SelectTrigger>
              <SelectContent>
                {executives.map((e) => (
                  <SelectItem key={e.userId} value={e.userId}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (৳)</Label>
            <Input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Order / Invoice Reference (optional)</Label>
            <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="e.g., ORD-12345" />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for manual entry..." rows={2} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !execId || amount <= 0}>{saving ? "Adding..." : "Add Entry"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
