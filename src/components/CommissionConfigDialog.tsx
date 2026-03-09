import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface CommissionConfigData {
  id?: string;
  executive_id: string;
  project_id: string;
  enabled: boolean;
  type: string;
  rate: number;
  apply_on: string;
  min_order_value: number;
  max_commission_cap: number | null;
  auto_generate: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: CommissionConfigData | null;
  executiveName: string;
  onSave: (data: CommissionConfigData) => Promise<void>;
}

export default function CommissionConfigDialog({ open, onOpenChange, config, executiveName, onSave }: Props) {
  const [form, setForm] = useState<CommissionConfigData>({
    executive_id: "",
    project_id: "",
    enabled: false,
    type: "percentage",
    rate: 5,
    apply_on: "repeat_orders",
    min_order_value: 0,
    max_commission_cap: null,
    auto_generate: true,
  });
  const [capEnabled, setCapEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setForm(config);
      setCapEnabled(config.max_commission_cap != null && config.max_commission_cap > 0);
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...form,
        max_commission_cap: capEnabled ? (form.max_commission_cap || 0) : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Commission Settings — {executiveName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label>Enable Commission</Label>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Commission Type</Label>
            <RadioGroup value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="percentage" id="pct" />
                <Label htmlFor="pct" className="font-normal">Percentage (%)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fixed" id="fix" />
                <Label htmlFor="fix" className="font-normal">Fixed (৳)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Rate */}
          <div className="space-y-1.5">
            <Label>Rate {form.type === "percentage" ? "(%)" : "(৳ per order)"}</Label>
            <Input
              type="number"
              min={0}
              value={form.rate}
              onChange={(e) => setForm((f) => ({ ...f, rate: Number(e.target.value) }))}
            />
          </div>

          {/* Apply On */}
          <div className="space-y-1.5">
            <Label>Apply On</Label>
            <Select value={form.apply_on} onValueChange={(v) => setForm((f) => ({ ...f, apply_on: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="repeat_orders">Repeat Orders Only</SelectItem>
                <SelectItem value="all_orders">All Orders</SelectItem>
                <SelectItem value="upsell_orders">Upsell Orders Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min order value */}
          <div className="space-y-1.5">
            <Label>Minimum Order Value (৳)</Label>
            <Input
              type="number"
              min={0}
              value={form.min_order_value}
              onChange={(e) => setForm((f) => ({ ...f, min_order_value: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">Orders below this value won't generate commission</p>
          </div>

          {/* Max cap */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Max Commission Cap</Label>
              <Switch checked={capEnabled} onCheckedChange={setCapEnabled} />
            </div>
            {capEnabled && (
              <Input
                type="number"
                min={0}
                placeholder="Max amount per entry"
                value={form.max_commission_cap ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, max_commission_cap: Number(e.target.value) }))}
              />
            )}
          </div>

          {/* Auto generate */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Generate Entries</Label>
              <p className="text-xs text-muted-foreground">Automatically create commission for qualifying orders</p>
            </div>
            <Switch checked={form.auto_generate} onCheckedChange={(v) => setForm((f) => ({ ...f, auto_generate: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
