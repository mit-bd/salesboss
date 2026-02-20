import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export type BulkFieldType = "assignExecutive" | "deliveryMethod" | "orderSource" | "followupDate";

interface BulkSingleFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldType: BulkFieldType;
  selectedIds: Set<string>;
  onComplete: () => void;
}

const TITLES: Record<BulkFieldType, string> = {
  assignExecutive: "Assign Executive",
  deliveryMethod: "Change Delivery Method",
  orderSource: "Change Order Source",
  followupDate: "Update Next Followup Date",
};

export default function BulkSingleFieldDialog({ open, onOpenChange, fieldType, selectedIds, onComplete }: BulkSingleFieldDialogProps) {
  const [value, setValue] = useState("");
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

  const count = selectedIds.size;

  const handleSubmit = async () => {
    if (!value) return;
    setConfirmOpen(false);
    setSaving(true);

    try {
      const ids = Array.from(selectedIds);
      const updatePayload: Record<string, any> = {};
      let detail = "";

      switch (fieldType) {
        case "assignExecutive": {
          const isUnassign = value === "__unassign__";
          const exec = allExecutives.find((e) => e.id === value);
          updatePayload.assigned_to = isUnassign ? null : value;
          updatePayload.assigned_to_name = isUnassign ? "" : (exec?.name || "");
          detail = isUnassign ? "Assignment removed" : `Assigned to ${exec?.name}`;
          break;
        }
        case "deliveryMethod": {
          updatePayload.delivery_method = value;
          const dm = deliveryMethods.find((m) => m.id === value);
          detail = `Delivery: ${dm?.name || value}`;
          break;
        }
        case "orderSource": {
          updatePayload.order_source = value;
          detail = `Source: ${value}`;
          break;
        }
        case "followupDate": {
          updatePayload.followup_date = value;
          detail = `Followup date: ${value}`;
          break;
        }
      }

      // Use atomic bulk update RPC for transactional safety
      const { data: affectedCount, error } = await supabase.rpc("bulk_update_orders", {
        p_order_ids: ids,
        p_updates: updatePayload,
      });

      if (error) {
        console.error(`[BulkSingleField:${fieldType}] Atomic bulk update failed:`, error);
        throw error;
      }

      console.info(`[BulkSingleField:${fieldType}] Atomically updated ${affectedCount} orders`);
      await refreshOrders();

      addLog({
        actionType: `Bulk ${TITLES[fieldType]}`,
        userName: profile?.full_name || "Admin User",
        role: role || "unknown",
        entity: `${count} orders`,
        details: detail,
      });

      toast({ title: "Bulk Update Complete", description: `${affectedCount} order(s): ${detail}` });
      setValue("");
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      console.error(`[BulkSingleField:${fieldType}] Error:`, err);
      toast({ title: "Error", description: err.message + ". No records were modified.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const renderField = () => {
    switch (fieldType) {
      case "assignExecutive":
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger><SelectValue placeholder="Select executive" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassign__"><span className="text-muted-foreground">Remove Assignment</span></SelectItem>
              {allExecutives.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case "deliveryMethod":
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger><SelectValue placeholder="Select delivery method" /></SelectTrigger>
            <SelectContent>
              {deliveryMethods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case "orderSource":
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
            <SelectContent>
              {orderSources.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case "followupDate":
        return <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{TITLES[fieldType]}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg bg-muted/50 p-3 mb-3">
          <p className="text-sm font-medium">{count} order{count !== 1 ? "s" : ""} selected</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{TITLES[fieldType]} *</Label>
          {renderField()}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          {!confirmOpen ? (
            <Button onClick={() => setConfirmOpen(true)} disabled={!value || saving}>
              Apply to {count}
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
