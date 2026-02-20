import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { useOrderSources } from "@/hooks/useOrderSources";
import { mockSalesExecutives } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrderStore } from "@/contexts/OrderStoreContext";

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  onComplete: () => void;
}

interface FieldState {
  enabled: boolean;
  value: string;
}

export default function BulkEditDialog({ open, onOpenChange, selectedIds, onComplete }: BulkEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const { addLog } = useAuditLog();
  const { profile, role } = useAuth();
  const { refreshOrders } = useOrderStore();
  const { members } = useTeamMembers();
  const { methods: deliveryMethods } = useDeliveryMethods({ activeOnly: true });
  const { sources: orderSources } = useOrderSources({ activeOnly: true });

  const allExecutives = [
    ...members.map((m) => ({ id: m.userId, name: m.name })),
    ...mockSalesExecutives.filter((se) => !members.some((m) => m.userId === se.id)).map((se) => ({ id: se.id, name: se.name })),
  ];

  const [fields, setFields] = useState<Record<string, FieldState>>({
    assignedTo: { enabled: false, value: "" },
    deliveryMethod: { enabled: false, value: "" },
    orderSource: { enabled: false, value: "" },
    followupDate: { enabled: false, value: "" },
    price: { enabled: false, value: "" },
    currentStatus: { enabled: false, value: "" },
  });

  const toggleField = (key: string) => {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  };

  const updateValue = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const enabledCount = Object.values(fields).filter((f) => f.enabled && f.value).length;
  const count = selectedIds.size;

  const handleSubmit = async () => {
    if (enabledCount === 0) return;
    setConfirmOpen(false);
    setSaving(true);

    try {
      const ids = Array.from(selectedIds);
      const updatePayload: Record<string, any> = {};
      const changes: string[] = [];

      if (fields.assignedTo.enabled && fields.assignedTo.value) {
        const isUnassign = fields.assignedTo.value === "__unassign__";
        const exec = allExecutives.find((e) => e.id === fields.assignedTo.value);
        updatePayload.assigned_to = isUnassign ? null : fields.assignedTo.value;
        updatePayload.assigned_to_name = isUnassign ? "" : (exec?.name || "");
        changes.push(isUnassign ? "Unassigned" : `Assigned to ${exec?.name}`);
      }

      if (fields.deliveryMethod.enabled && fields.deliveryMethod.value) {
        updatePayload.delivery_method = fields.deliveryMethod.value;
        const dm = deliveryMethods.find((m) => m.id === fields.deliveryMethod.value);
        changes.push(`Delivery: ${dm?.name || fields.deliveryMethod.value}`);
      }

      if (fields.orderSource.enabled && fields.orderSource.value) {
        updatePayload.order_source = fields.orderSource.value;
        changes.push(`Source: ${fields.orderSource.value}`);
      }

      if (fields.followupDate.enabled && fields.followupDate.value) {
        updatePayload.followup_date = fields.followupDate.value;
        changes.push(`Followup date: ${fields.followupDate.value}`);
      }

      if (fields.price.enabled && fields.price.value) {
        updatePayload.price = Number(fields.price.value);
        changes.push(`Amount: ৳${fields.price.value}`);
      }

      if (fields.currentStatus.enabled && fields.currentStatus.value) {
        updatePayload.current_status = fields.currentStatus.value;
        changes.push(`Status: ${fields.currentStatus.value}`);
      }

      if (Object.keys(updatePayload).length === 0) return;

      // Use atomic bulk update RPC for transactional safety
      const { data: affectedCount, error } = await supabase.rpc("bulk_update_orders", {
        p_order_ids: ids,
        p_updates: updatePayload,
      });

      if (error) {
        console.error("[BulkEdit] Atomic bulk update failed:", error);
        throw error;
      }

      console.info(`[BulkEdit] Atomically updated ${affectedCount} orders`);
      await refreshOrders();

      const userName = profile?.full_name || "Admin User";
      addLog({
        actionType: "Bulk Edit",
        userName,
        role: role || "unknown",
        entity: `${count} orders`,
        details: changes.join("; "),
      });

      toast({ title: "Bulk Update Complete", description: `${affectedCount} order(s) updated: ${changes.join(", ")}` });

      // Reset
      setFields({
        assignedTo: { enabled: false, value: "" },
        deliveryMethod: { enabled: false, value: "" },
        orderSource: { enabled: false, value: "" },
        followupDate: { enabled: false, value: "" },
        price: { enabled: false, value: "" },
        currentStatus: { enabled: false, value: "" },
      });
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[BulkEdit] Error:", err);
      toast({ title: "Bulk Update Failed", description: err.message || "An error occurred. No records were modified.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Bulk Edit — {count} Order{count !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground mb-4">
          Check the fields you want to update. Only checked fields will be modified across all selected orders.
        </p>

        <div className="space-y-4">
          {/* Assign Executive */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox checked={fields.assignedTo.enabled} onCheckedChange={() => toggleField("assignedTo")} className="mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-medium">Assign Executive</Label>
              {fields.assignedTo.enabled && (
                <Select value={fields.assignedTo.value} onValueChange={(v) => updateValue("assignedTo", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select executive" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassign__"><span className="text-muted-foreground">Remove Assignment</span></SelectItem>
                    {allExecutives.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Delivery Method */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox checked={fields.deliveryMethod.enabled} onCheckedChange={() => toggleField("deliveryMethod")} className="mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-medium">Delivery Method</Label>
              {fields.deliveryMethod.enabled && (
                <Select value={fields.deliveryMethod.value} onValueChange={(v) => updateValue("deliveryMethod", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select delivery method" /></SelectTrigger>
                  <SelectContent>
                    {deliveryMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Order Source */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox checked={fields.orderSource.enabled} onCheckedChange={() => toggleField("orderSource")} className="mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-medium">Order Source</Label>
              {fields.orderSource.enabled && (
                <Select value={fields.orderSource.value} onValueChange={(v) => updateValue("orderSource", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {orderSources.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Followup Date */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox checked={fields.followupDate.enabled} onCheckedChange={() => toggleField("followupDate")} className="mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-medium">Next Followup Date</Label>
              {fields.followupDate.enabled && (
                <Input type="date" className="h-8 text-xs" value={fields.followupDate.value} onChange={(e) => updateValue("followupDate", e.target.value)} />
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox checked={fields.price.enabled} onCheckedChange={() => toggleField("price")} className="mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-medium">Amount (৳)</Label>
              {fields.price.enabled && (
                <Input type="number" className="h-8 text-xs" placeholder="Enter amount" value={fields.price.value} onChange={(e) => updateValue("price", e.target.value)} />
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox checked={fields.currentStatus.enabled} onCheckedChange={() => toggleField("currentStatus")} className="mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              {fields.currentStatus.enabled && (
                <Select value={fields.currentStatus.value} onValueChange={(v) => updateValue("currentStatus", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation / Submit */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <p className="text-xs text-muted-foreground">
            {enabledCount > 0 ? `${enabledCount} field(s) will be updated` : "Select at least one field"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            {!confirmOpen ? (
              <Button size="sm" disabled={enabledCount === 0 || saving} onClick={() => setConfirmOpen(true)}>
                Update {count} Order{count !== 1 ? "s" : ""}
              </Button>
            ) : (
              <div className="flex items-center gap-2 animate-fade-in">
                <div className="flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Confirm?</span>
                </div>
                <Button size="sm" variant="destructive" onClick={handleSubmit} disabled={saving}>
                  {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Yes, Update All
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
                  No
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
