import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface SalesTargetData {
  id?: string;
  executive_id: string;
  project_id: string;
  period_type: string;
  start_date: string;
  end_date: string;
  target_orders: number;
  target_repeat_orders: number;
  target_revenue: number;
  target_upsell_count: number;
  target_followups: number;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SalesTargetData | null;
  executiveName: string;
  onSave: (data: SalesTargetData) => Promise<void>;
}

export default function SalesTargetDialog({ open, onOpenChange, target, executiveName, onSave }: Props) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [form, setForm] = useState<SalesTargetData>({
    executive_id: "",
    project_id: "",
    period_type: "monthly",
    start_date: monthStart,
    end_date: monthEnd,
    target_orders: 0,
    target_repeat_orders: 0,
    target_revenue: 0,
    target_upsell_count: 0,
    target_followups: 0,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setForm(target);
    } else {
      setForm((f) => ({ ...f, start_date: monthStart, end_date: monthEnd }));
    }
  }, [target, monthStart, monthEnd]);

  const handlePeriodChange = (type: string) => {
    const n = new Date();
    let start = monthStart;
    let end = monthEnd;
    if (type === "quarterly") {
      const qStart = new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1);
      const qEnd = new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3 + 3, 0);
      start = qStart.toISOString().slice(0, 10);
      end = qEnd.toISOString().slice(0, 10);
    }
    setForm((f) => ({ ...f, period_type: type, start_date: start, end_date: end }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const numField = (label: string, key: keyof SalesTargetData) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={form[key] as number}
        onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Target — {executiveName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Period</Label>
            <Select value={form.period_type} onValueChange={handlePeriodChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} disabled={form.period_type !== "custom"} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} disabled={form.period_type !== "custom"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {numField("Target Orders", "target_orders")}
            {numField("Repeat Orders", "target_repeat_orders")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {numField("Revenue (৳)", "target_revenue")}
            {numField("Upsell Count", "target_upsell_count")}
          </div>
          {numField("Followups Completed", "target_followups")}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Target"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
