import { useMemo, useState, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useRole } from "@/contexts/RoleContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BulkDeleteRestoreDialog, { BulkPhase } from "@/components/BulkDeleteRestoreDialog";
import BulkHardDeleteDialog, { HardDeletePhase } from "@/components/BulkHardDeleteDialog";
import { RotateCcw, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DeletedOrdersPage() {
  const { deletedOrders, restoreOrder, hardDelete, refreshOrders } = useOrderStore();
  const { isAdmin, isOwner } = useRole();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [bulkPhase, setBulkPhase] = useState<BulkPhase>("idle");
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkHardOpen, setBulkHardOpen] = useState(false);
  const [hardPhase, setHardPhase] = useState<HardDeletePhase>("idle");
  const [hardProgress, setHardProgress] = useState(0);

  const canRestore = isAdmin || hasPermission("orders.delete");
  const canHardDelete = isOwner || isAdmin || hasPermission("orders.hard_delete");


  const allChecked = deletedOrders.length > 0 && selected.size === deletedOrders.length;
  const someChecked = selected.size > 0 && selected.size < deletedOrders.length;

  const toggleAll = useCallback(() => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(deletedOrders.map((o) => o.id)));
  }, [allChecked, deletedOrders]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Access restricted to Admin only.
        </div>
      </AppLayout>
    );
  }

  const handleRestore = async (id: string) => {
    await restoreOrder(id);
  };

  const handleHardDelete = async () => {
    if (!hardDeleteId) return;
    await hardDelete(hardDeleteId);
    toast({ title: "Permanently Deleted", description: `Order #${hardDeleteId} permanently removed.`, variant: "destructive" });
    setHardDeleteId(null);
  };

  const runBulkRestore = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkPhase("preparing");
    setBulkProgress(5);
    try {
      const CHUNK = 1000;
      let done = 0;
      let totalAffected = 0;
      for (let i = 0; i < ids.length; i += CHUNK) {
        setBulkPhase("processing");
        const chunk = ids.slice(i, i + CHUNK);
        const { data, error } = await supabase.rpc("bulk_restore_orders", { p_order_ids: chunk });
        if (error) throw error;
        totalAffected += Number((data as any)?.affected || 0);
        done += chunk.length;
        setBulkProgress(Math.min(90, Math.round((done / ids.length) * 90)));
      }
      setBulkPhase("recalculating"); setBulkProgress(94);
      setBulkPhase("refreshing"); setBulkProgress(97);
      await refreshOrders();
      setBulkPhase("done"); setBulkProgress(100);
      toast({ title: "Bulk restore complete", description: `${totalAffected.toLocaleString()} orders restored.` });
      setTimeout(() => {
        setBulkRestoreOpen(false); setBulkPhase("idle"); setBulkProgress(0); clearSelection();
      }, 800);
    } catch (e: any) {
      setBulkPhase("idle"); setBulkProgress(0);
      toast({ title: "Bulk restore failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Deleted Orders" description="Soft-deleted orders — restore or permanently remove" />

      {selected.size > 0 && canRestore && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 animate-fade-in">
          <span className="inline-flex items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
            {selected.size.toLocaleString()}
          </span>
          <span className="text-sm font-medium">Selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => setBulkRestoreOpen(true)}>
              <RotateCcw className="h-3.5 w-3.5" /> Bulk Restore
            </Button>
            <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allChecked ? true : someChecked ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  disabled={deletedOrders.length === 0}
                />
              </TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deletedOrders.map((order) => (
              <TableRow key={order.id} data-state={selected.has(order.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleOne(order.id)} />
                </TableCell>
                <TableCell className="font-medium text-foreground">{order.generatedOrderId || order.invoiceId || order.id}</TableCell>
                <TableCell>
                  <p className="font-medium text-foreground">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.mobile}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">{order.productTitle}</TableCell>
                <TableCell className="text-right font-medium">৳{Number(order.price || 0).toLocaleString("en-BD")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{order.orderDate}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => handleRestore(order.id)}>
                      <RotateCcw className="h-3 w-3" /> Restore
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => setHardDeleteId(order.id)}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {deletedOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No deleted orders.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!hardDeleteId} onOpenChange={(o) => !o && setHardDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove order <strong>#{hardDeleteId}</strong> and its child orders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHardDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canRestore && (
        <BulkDeleteRestoreDialog
          open={bulkRestoreOpen}
          onOpenChange={(o) => { if (bulkPhase === "idle" || bulkPhase === "done") setBulkRestoreOpen(o); }}
          mode="restore"
          count={selected.size}
          phase={bulkPhase}
          progress={bulkProgress}
          onConfirm={runBulkRestore}
        />
      )}
    </AppLayout>
  );
}
