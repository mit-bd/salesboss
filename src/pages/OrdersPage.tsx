import { useState, useEffect, useMemo, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import CreateOrderDialog from "@/components/CreateOrderDialog";
import EditOrderDialog from "@/components/EditOrderDialog";
import BulkActionBar from "@/components/BulkActionBar";
import BulkEditDialog from "@/components/BulkEditDialog";
import BulkSingleFieldDialog, { BulkFieldType } from "@/components/BulkSingleFieldDialog";
import BulkDeleteRestoreDialog, { BulkPhase } from "@/components/BulkDeleteRestoreDialog";
import OrderTable from "@/components/OrderTable";
import { useRole } from "@/contexts/RoleContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useServerPaginatedOrders } from "@/hooks/useServerPaginatedOrders";
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/data";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [conflictIds, setConflictIds] = useState<Set<string>>(new Set());
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [singleFieldOpen, setSingleFieldOpen] = useState(false);
  const [singleFieldType, setSingleFieldType] = useState<BulkFieldType>("assignExecutive");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPhase, setBulkPhase] = useState<BulkPhase>("idle");
  const [bulkProgress, setBulkProgress] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const { isAdmin } = useRole();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();
  const canEditOrder = isAdmin || hasPermission("orders.edit");
  const canDeleteOrder = isAdmin || hasPermission("orders.delete");
  const { updateOrder, refreshOrders } = useOrderStore();


  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Convert GlobalFilters to server filters
  const serverFilters = useMemo(() => ({
    search: debouncedSearch || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    salesExecutive: filters.salesExecutive || undefined,
    product: filters.product || undefined,
    orderSource: filters.orderSource || undefined,
    followupStep: filters.followupStep || undefined,
    deliveryMethod: filters.deliveryMethod || undefined,
  }), [debouncedSearch, filters]);

  const {
    orders,
    totalCount,
    page,
    setPage,
    totalPages,
    loading,
    updateFilters,
    refresh,
    fetchAllMatchingIds,
  } = useServerPaginatedOrders(pageSize);

  // Update server filters when they change
  useEffect(() => {
    updateFilters(serverFilters);
    setAllMatchingSelected(false);
  }, [serverFilters, updateFilters]);

  const openSingleField = (type: BulkFieldType) => {
    setSingleFieldType(type);
    setSingleFieldOpen(true);
  };

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setConflictIds(new Set());
    setAllMatchingSelected(false);
  }, []);

  const clearSelectionAndRefresh = useCallback(() => {
    clearSelection();
    refresh();
  }, [clearSelection, refresh]);

  const handleSelectAllMatching = useCallback(async () => {
    try {
      const ids = await fetchAllMatchingIds(20000);
      setSelectedIds(new Set(ids));
      setAllMatchingSelected(true);
      if (ids.length >= 20000) {
        toast({ title: "Selection capped", description: "Selected the first 20,000 matching orders." });
      }
    } catch (e: any) {
      toast({ title: "Could not select all", description: e?.message, variant: "destructive" });
    }
  }, [fetchAllMatchingIds, toast]);

  const runBulkDelete = useCallback(async (reason: string) => {
    const idsAll = Array.from(selectedIds);
    if (idsAll.length === 0) return;
    setBulkPhase("preparing");
    setBulkProgress(5);
    try {
      const CHUNK = 1000;
      let done = 0;
      let totalAffected = 0;
      for (let i = 0; i < idsAll.length; i += CHUNK) {
        setBulkPhase("processing");
        const chunk = idsAll.slice(i, i + CHUNK);
        const { data, error } = await supabase.rpc("bulk_soft_delete_orders", {
          p_order_ids: chunk,
          p_reason: reason || "Bulk Delete",
        });
        if (error) throw error;
        totalAffected += Number((data as any)?.affected || 0);
        done += chunk.length;
        setBulkProgress(Math.min(90, Math.round((done / idsAll.length) * 90)));
      }
      setBulkPhase("recalculating");
      setBulkProgress(94);
      setBulkPhase("refreshing");
      setBulkProgress(97);
      await Promise.all([refresh(), refreshOrders()]);
      setBulkPhase("done");
      setBulkProgress(100);
      toast({ title: "Bulk delete complete", description: `${totalAffected.toLocaleString()} orders deleted.` });
      setTimeout(() => {
        setBulkDeleteOpen(false);
        setBulkPhase("idle");
        setBulkProgress(0);
        clearSelection();
      }, 800);
    } catch (e: any) {
      setBulkPhase("idle");
      setBulkProgress(0);
      toast({ title: "Bulk delete failed", description: e?.message, variant: "destructive" });
    }
  }, [selectedIds, refresh, refreshOrders, clearSelection, toast]);

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setPage(0);
  };


  return (
    <AppLayout>
      <PageHeader title="All Orders" description="View and manage all customer orders">
        <CreateOrderDialog />
      </PageHeader>

      <GlobalFilters filters={filters} onChange={setFilters} />

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, ID, or mobile..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Total Orders: <span className="font-semibold text-foreground">{totalCount.toLocaleString()}</span></span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Per page:</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading orders...</span>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ paddingBottom: selectedIds.size > 0 ? "72px" : undefined }}>
          <OrderTable
            orders={orders}
            isAdmin={isAdmin}
            onEdit={canEditOrder ? (order: Order) => {
              if (!isAdmin && order.assignedTo !== user?.id) {
                toast({ title: "Permission Denied", description: "You can only edit orders assigned to you.", variant: "destructive" });
                return;
              }
              setEditOrder(order);
            } : undefined}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            conflictIds={conflictIds}
            pageSize={pageSize}
            disableInternalPagination
          />

          {/* Server-side Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border border-border rounded-b-xl px-4 py-2.5 bg-muted/30 -mt-px">
              <p className="text-xs text-muted-foreground">
                {(page * pageSize + 1).toLocaleString()}–{Math.min((page + 1) * pageSize, totalCount).toLocaleString()} of {totalCount.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {editOrder && (
        <EditOrderDialog order={editOrder} open={!!editOrder} onOpenChange={(open) => !open && setEditOrder(null)} onSave={async (updated) => { await updateOrder(updated); setEditOrder(null); refresh(); }} />
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
            onConflict={setConflictIds}
          />
          <BulkSingleFieldDialog
            open={singleFieldOpen}
            onOpenChange={setSingleFieldOpen}
            fieldType={singleFieldType}
            selectedIds={selectedIds}
            onComplete={clearSelection}
            onConflict={setConflictIds}
          />
        </>
      )}
    </AppLayout>
  );
}
