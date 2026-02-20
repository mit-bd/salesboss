import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import CreateOrderDialog from "@/components/CreateOrderDialog";
import EditOrderDialog from "@/components/EditOrderDialog";
import BulkActionBar from "@/components/BulkActionBar";
import BulkEditDialog from "@/components/BulkEditDialog";
import BulkSingleFieldDialog, { BulkFieldType } from "@/components/BulkSingleFieldDialog";
import OrderTable from "@/components/OrderTable";
import { useRole } from "@/contexts/RoleContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { Order } from "@/types/data";
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
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [singleFieldOpen, setSingleFieldOpen] = useState(false);
  const [singleFieldType, setSingleFieldType] = useState<BulkFieldType>("assignExecutive");
  const { isAdmin } = useRole();
  const { activeOrders, updateOrder } = useOrderStore();
  const filtered = applyFilters(activeOrders, filters, search);

  const openSingleField = (type: BulkFieldType) => {
    setSingleFieldType(type);
    setSingleFieldOpen(true);
  };

  const clearSelection = () => setSelectedIds(new Set());

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

      <div className="animate-fade-in" style={{ paddingBottom: selectedIds.size > 0 ? "72px" : undefined }}>
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

      {isAdmin && (
        <>
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            onBulkEdit={() => setBulkEditOpen(true)}
            onAssignExecutive={() => openSingleField("assignExecutive")}
            onChangeDeliveryMethod={() => openSingleField("deliveryMethod")}
            onChangeOrderSource={() => openSingleField("orderSource")}
            onUpdateFollowupDate={() => openSingleField("followupDate")}
          />
          <BulkEditDialog
            open={bulkEditOpen}
            onOpenChange={setBulkEditOpen}
            selectedIds={selectedIds}
            onComplete={clearSelection}
          />
          <BulkSingleFieldDialog
            open={singleFieldOpen}
            onOpenChange={setSingleFieldOpen}
            fieldType={singleFieldType}
            selectedIds={selectedIds}
            onComplete={clearSelection}
          />
        </>
      )}
    </AppLayout>
  );
}
