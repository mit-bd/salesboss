import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, X } from "lucide-react";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import CreateOrderDialog from "@/components/CreateOrderDialog";
import EditOrderDialog from "@/components/EditOrderDialog";
import BulkAssignDialog from "@/components/BulkAssignDialog";
import OrderTable from "@/components/OrderTable";
import { useRole } from "@/contexts/RoleContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { Order } from "@/types/data";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function applyFilters(orders: Order[], filters: FilterState, search: string): Order[] {
  return orders.filter((o) => {
    if (search && !o.customerName.toLowerCase().includes(search.toLowerCase()) && !o.id.toLowerCase().includes(search.toLowerCase()) && !o.mobile.includes(search)) return false;
    if (filters.dateFrom && o.orderDate < filters.dateFrom) return false;
    if (filters.dateTo && o.orderDate > filters.dateTo) return false;
    if (filters.salesExecutive && o.assignedTo !== filters.salesExecutive) return false;
    if (filters.product && o.productId !== filters.product) return false;
    if (filters.orderSource && o.orderSource !== filters.orderSource) return false;
    if (filters.followupStep && o.followupStep !== Number(filters.followupStep)) return false;
    if (filters.deliveryMethod && o.deliveryMethod !== filters.deliveryMethod) return false;
    return true;
  });
}

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const { isAdmin } = useRole();
  const { activeOrders, updateOrder, refreshOrders } = useOrderStore();
  const { addLog } = useAuditLog();
  const { profile, role } = useAuth();
  const { toast } = useToast();
  const filtered = applyFilters(activeOrders, filters, search);
  const userName = profile?.full_name || "Admin User";

  const handleBulkAssign = async (executiveId: string, executiveName: string) => {
    const isUnassign = executiveId === "__unassign__";
    const ids = Array.from(selectedIds);

    const { error } = await supabase
      .from("orders")
      .update({
        assigned_to: isUnassign ? null : executiveId,
        assigned_to_name: isUnassign ? "" : executiveName,
      })
      .in("id", ids);

    if (error) {
      console.error("[OrdersPage] Bulk assign error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      throw error;
    }

    await refreshOrders();
    setSelectedIds(new Set());

    const action = isUnassign ? "Assignment Removed" : "Bulk Assigned";
    toast({ title: action, description: `${ids.length} order(s) ${isUnassign ? "unassigned" : `assigned to ${executiveName}`}` });
    addLog({
      actionType: action,
      userName,
      role: role || "unknown",
      entity: `${ids.length} orders`,
      details: isUnassign ? "Assignment removed" : `Assigned to ${executiveName}`,
    });
  };

  return (
    <AppLayout>
      <PageHeader title="All Orders" description="View and manage all customer orders">
        <CreateOrderDialog />
      </PageHeader>

      <GlobalFilters filters={filters} onChange={setFilters} />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, ID, or mobile..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (isAdmin) && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 animate-fade-in">
          <span className="text-xs font-medium text-foreground">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => setBulkAssignOpen(true)}>
            <UserPlus className="h-3 w-3" /> Assign to Executive
          </Button>
          <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 text-muted-foreground" onClick={() => setSelectedIds(new Set())}>
            <X className="h-3 w-3" /> Clear
          </Button>
        </div>
      )}

      <div className="animate-fade-in">
        <OrderTable
          orders={filtered}
          isAdmin={isAdmin}
          onEdit={setEditOrder}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </div>

      {editOrder && (
        <EditOrderDialog order={editOrder} open={!!editOrder} onOpenChange={(open) => !open && setEditOrder(null)} onSave={async (updated) => { await updateOrder(updated); setEditOrder(null); }} />
      )}

      <BulkAssignDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        selectedCount={selectedIds.size}
        onAssign={handleBulkAssign}
      />
    </AppLayout>
  );
}
