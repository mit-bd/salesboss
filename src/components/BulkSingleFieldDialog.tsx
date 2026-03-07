import { useState } from "react";
import { createAssignmentNotifications } from "@/hooks/useNotifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { useOrderSources } from "@/hooks/useOrderSources";
import { mockSalesExecutives } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useBulkConflict } from "@/hooks/useBulkConflict";

export type BulkFieldType = "assignExecutive" | "deliveryMethod" | "orderSource" | "followupDate";

interface BulkSingleFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldType: BulkFieldType;
  selectedIds: Set<string>;
  onComplete: () => void;
  onConflict?: (conflictIds: Set<string>) => void;
}

const TITLES: Record<BulkFieldType, string> = {
  assignExecutive: "Assign Executive",
  deliveryMethod: "Change Delivery Method",
  orderSource: "Change Order Source",
  followupDate: "Update Next Followup Date",
};

export default function BulkSingleFieldDialog({ open, onOpenChange, fieldType, selectedIds, onComplete, onConflict }: BulkSingleFieldDialogProps) {
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
  const { buildVersionMap, handleConflictResponse, conflict, clearConflict } = useBulkConflict();

  const allExecutives = [
    ...members.map((m) => ({ id: m.userId, name: m.name })),
    ...mockSalesExecutives.filter((se) => !members.some((m) => m.userId === se.id)).map((se) => ({ id: se.id, name: se.name })),
  ];

  const count = selectedIds.size;

  const handleReload = async () => {
    clearConflict();
    await refreshOrders();
    toast({ title: "Data Reloaded", description: "Latest order data has been fetched." });
  };

  const handleSubmit = async () => {
    if (!value) return;
    setConfirmOpen(false);
    setSaving(true);
    clearConflict();

    try {
      const ids = Array.from(selectedIds);
      const versions = buildVersionMap(ids);
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

      // Use version-checked atomic bulk update
      const { data: result, error } = await supabase.rpc("bulk_update_orders_with_lock", {
        p_order_ids: ids,
        p_versions: versions,
        p_updates: updatePayload,
      });

      if (error) {
        console.error(`[BulkSingleField:${fieldType}] Atomic bulk update failed:`, error);
        throw error;
      }

      // Check for conflicts
      if (handleConflictResponse(result as any)) {
        const conflictResult = result as any;
        addLog({
          actionType: `Bulk ${TITLES[fieldType]} Failed`,
          userName: profile?.full_name || "Admin User",
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
      console.info(`[BulkSingleField:${fieldType}] Atomically updated ${successResult.affected_count} orders`);
      await refreshOrders();

      // Create notifications for bulk assignment
      if (fieldType === "assignExecutive" && value !== "__unassign__" && user && profile?.project_id) {
        const exec = allExecutives.find((e) => e.id === value);
        if (exec) {
          for (const orderId of ids) {
            const order = activeOrders.find((o) => o.id === orderId);
            if (order) {
              await createAssignmentNotifications({
                orderId,
                orderName: order.customerName,
                assignedToId: value,
                assignedToName: exec.name,
                assignedById: user.id,
                projectId: profile.project_id,
              });
            }
          }
        }
      }

      addLog({
        actionType: `Bulk ${TITLES[fieldType]}`,
        userName: profile?.full_name || "Admin User",
        role: role || "unknown",
        entity: `${count} orders`,
        details: detail,
      });

      toast({ title: "Bulk Update Complete", description: `${successResult.affected_count} order(s): ${detail}` });
      setValue("");
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      console.error(`[BulkSingleField:${fieldType}] Error:`, err);
      if (!conflict.hasConflict) {
        toast({ title: "Error", description: err.message + ". No records were modified.", variant: "destructive" });
      }
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) clearConflict(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{TITLES[fieldType]}</DialogTitle>
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
          <p className="text-sm font-medium">{count} order{count !== 1 ? "s" : ""} selected</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{TITLES[fieldType]} *</Label>
          {renderField()}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => { clearConflict(); onOpenChange(false); }} disabled={saving}>Cancel</Button>
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
