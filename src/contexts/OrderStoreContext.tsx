import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { Order } from "@/types/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "./AuditLogContext";
import { useAuth } from "./AuthContext";
import { useToast } from "@/hooks/use-toast";

interface OrderStoreContextType {
  orders: Order[];
  deletedOrders: Order[];
  activeOrders: Order[];
  loading: boolean;
  softDelete: (orderId: string) => Promise<void>;
  restoreOrder: (orderId: string) => Promise<void>;
  hardDelete: (orderId: string) => Promise<void>;
  updateOrder: (updated: Order) => Promise<void>;
  addOrder: (order: Omit<Order, "id">) => Promise<void>;
  refreshOrders: () => Promise<void>;
}

const OrderStoreContext = createContext<OrderStoreContextType | null>(null);

function mapRow(row: any): Order {
  return {
    id: row.id,
    customerName: row.customer_name,
    mobile: row.mobile,
    address: row.address || "",
    orderSource: row.order_source || "Website",
    productId: row.product_id || "",
    productTitle: row.product_title || "",
    price: Number(row.price),
    note: row.note || "",
    followupStep: row.followup_step || 1,
    followupDate: row.followup_date || "",
    assignedTo: row.assigned_to || "",
    assignedToName: row.assigned_to_name || "",
    createdAt: row.created_at?.split("T")[0] || "",
    orderDate: row.order_date || "",
    deliveryDate: row.delivery_date || "",
    deliveryMethod: row.delivery_method || "",
    parentOrderId: row.parent_order_id || null,
    isRepeat: row.is_repeat || false,
    isUpsell: row.is_upsell || false,
    health: row.health || "new",
    isDeleted: row.is_deleted || false,
    paidAmount: Number(row.paid_amount) || 0,
    invoiceId: row.invoice_id || row.id,
  };
}

export function OrderStoreProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { addLog } = useAuditLog();
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const userName = profile?.full_name || user?.email || "Admin User";

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[OrderStore] Fetch error:", error);
      return;
    }
    if (isMounted.current) {
      setOrders((data || []).map(mapRow));
      setLoading(false);
    }
  }, []);

  // Realtime: apply granular changes instead of full refetch
  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        if (!isMounted.current) return;
        const newOrder = mapRow(payload.new);
        setOrders((prev) => {
          if (prev.some((o) => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        if (!isMounted.current) return;
        const updated = mapRow(payload.new);
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, (payload) => {
        if (!isMounted.current) return;
        const deletedId = (payload.old as any).id;
        setOrders((prev) => prev.filter((o) => o.id !== deletedId));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  const activeOrders = orders.filter((o) => !o.isDeleted);
  const deletedOrders = orders.filter((o) => o.isDeleted);

  const addOrder = useCallback(
    async (order: Omit<Order, "id">) => {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          customer_name: order.customerName,
          mobile: order.mobile,
          address: order.address,
          order_source: order.orderSource,
          product_id: order.productId || null,
          product_title: order.productTitle,
          price: order.price,
          note: order.note,
          followup_step: 1,
          followup_date: order.followupDate || null,
          assigned_to: order.assignedTo || null,
          assigned_to_name: order.assignedToName,
          order_date: order.orderDate,
          delivery_date: order.deliveryDate || null,
          delivery_method: order.deliveryMethod,
          parent_order_id: order.parentOrderId || null,
          is_repeat: order.isRepeat || false,
          is_upsell: order.isUpsell || false,
          health: "new",
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        console.error("[OrderStore] Create error:", error);
        toast({ title: "Error creating order", description: error.message, variant: "destructive" });
        return;
      }

      // Immediate local state update
      const newOrder = mapRow(data);
      setOrders((prev) => {
        if (prev.some((o) => o.id === newOrder.id)) return prev;
        return [newOrder, ...prev];
      });

      toast({ title: "Order created" });
      addLog({
        actionType: "Order Created",
        userName,
        role: role || "unknown",
        entity: `Order #${data.invoice_id}`,
        details: `Customer: ${order.customerName}`,
      });
    },
    [addLog, user, userName, role, toast]
  );

  const softDelete = useCallback(
    async (orderId: string) => {
      const childIds = orders.filter((o) => o.parentOrderId === orderId).map((o) => o.id);
      const idsToDelete = [orderId, ...childIds];

      // Optimistic update
      setOrders((prev) => prev.map((o) => idsToDelete.includes(o.id) ? { ...o, isDeleted: true } : o));

      const { error } = await supabase
        .from("orders")
        .update({ is_deleted: true })
        .in("id", idsToDelete);

      if (error) {
        console.error("[OrderStore] Soft delete error:", error);
        toast({ title: "Error deleting order", description: error.message, variant: "destructive" });
        // Rollback
        setOrders((prev) => prev.map((o) => idsToDelete.includes(o.id) ? { ...o, isDeleted: false } : o));
        return;
      }

      toast({ title: "Order deleted" });
      addLog({ actionType: "Order Soft Deleted", userName, role: role || "unknown", entity: `Order #${orderId}` });
    },
    [orders, addLog, userName, role, toast]
  );

  const restoreOrder = useCallback(
    async (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      const childIds = orders.filter((o) => o.parentOrderId === orderId).map((o) => o.id);
      const idsToRestore = [orderId, ...childIds];
      if (order?.parentOrderId) idsToRestore.push(order.parentOrderId);

      // Optimistic update
      setOrders((prev) => prev.map((o) => idsToRestore.includes(o.id) ? { ...o, isDeleted: false } : o));

      const { error } = await supabase
        .from("orders")
        .update({ is_deleted: false })
        .in("id", idsToRestore);

      if (error) {
        console.error("[OrderStore] Restore error:", error);
        toast({ title: "Error restoring order", description: error.message, variant: "destructive" });
        setOrders((prev) => prev.map((o) => idsToRestore.includes(o.id) ? { ...o, isDeleted: true } : o));
        return;
      }

      toast({ title: "Order restored" });
      addLog({ actionType: "Order Restored", userName, role: role || "unknown", entity: `Order #${orderId}` });
    },
    [orders, addLog, userName, role, toast]
  );

  const hardDelete = useCallback(
    async (orderId: string) => {
      const childIds = orders.filter((o) => o.parentOrderId === orderId).map((o) => o.id);
      const idsToDelete = [orderId, ...childIds];

      // Optimistic removal
      const backup = orders.filter((o) => idsToDelete.includes(o.id));
      setOrders((prev) => prev.filter((o) => !idsToDelete.includes(o.id)));

      const { error } = await supabase
        .from("orders")
        .delete()
        .in("id", idsToDelete);

      if (error) {
        console.error("[OrderStore] Hard delete error:", error);
        toast({ title: "Error deleting order", description: error.message, variant: "destructive" });
        // Rollback
        setOrders((prev) => [...backup, ...prev]);
        return;
      }

      toast({ title: "Order permanently deleted" });
      addLog({ actionType: "Order Permanently Deleted", userName, role: role || "unknown", entity: `Order #${orderId}` });
    },
    [orders, addLog, userName, role, toast]
  );

  const updateOrder = useCallback(
    async (updated: Order) => {
      // Optimistic update
      const prev = orders.find((o) => o.id === updated.id);
      setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)));

      const { data, error } = await supabase
        .from("orders")
        .update({
          customer_name: updated.customerName,
          mobile: updated.mobile,
          address: updated.address,
          order_source: updated.orderSource,
          product_id: updated.productId || null,
          product_title: updated.productTitle,
          price: updated.price,
          note: updated.note,
          followup_step: updated.followupStep,
          followup_date: updated.followupDate || null,
          assigned_to: updated.assignedTo || null,
          assigned_to_name: updated.assignedToName,
          order_date: updated.orderDate,
          delivery_date: updated.deliveryDate || null,
          delivery_method: updated.deliveryMethod,
          health: updated.health,
          paid_amount: updated.paidAmount || 0,
        })
        .eq("id", updated.id)
        .select()
        .single();

      if (error) {
        console.error("[OrderStore] Update error:", error);
        toast({ title: "Error updating order", description: error.message, variant: "destructive" });
        // Rollback
        if (prev) setOrders((list) => list.map((o) => (o.id === updated.id ? prev : o)));
        return;
      }

      // Replace with confirmed DB data
      if (data) {
        const confirmed = mapRow(data);
        setOrders((list) => list.map((o) => (o.id === confirmed.id ? confirmed : o)));
      }

      toast({ title: "Order updated" });
      addLog({
        actionType: "Order Edited",
        userName,
        role: role || "unknown",
        entity: `Order #${updated.id}`,
        details: `Updated order for ${updated.customerName}`,
      });
    },
    [orders, addLog, userName, role, toast]
  );

  return (
    <OrderStoreContext.Provider
      value={{ orders, deletedOrders, activeOrders, loading, softDelete, restoreOrder, hardDelete, updateOrder, addOrder, refreshOrders: fetchOrders }}
    >
      {children}
    </OrderStoreContext.Provider>
  );
}

export function useOrderStore() {
  const ctx = useContext(OrderStoreContext);
  if (!ctx) throw new Error("useOrderStore must be used within OrderStoreProvider");
  return ctx;
}
