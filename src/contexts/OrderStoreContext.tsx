import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
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

  const userName = profile?.full_name || user?.email || "Admin User";

  const fetchOrders = useCallback(async () => {
    console.log("[OrderStore] Fetching orders from database...");
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[OrderStore] Fetch error:", error);
      toast({ title: "Error loading orders", description: error.message, variant: "destructive" });
      return;
    }
    console.log("[OrderStore] Fetched", data?.length, "orders");
    setOrders((data || []).map(mapRow));
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        console.log("[OrderStore] Realtime change detected, refetching...");
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  const activeOrders = orders.filter((o) => !o.isDeleted);
  const deletedOrders = orders.filter((o) => o.isDeleted);

  const addOrder = useCallback(
    async (order: Omit<Order, "id">) => {
      console.log("[OrderStore] Creating order:", order);
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
      console.log("[OrderStore] Order created:", data);
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
      console.log("[OrderStore] Soft deleting order:", orderId);

      // Also soft-delete child orders
      const childIds = orders
        .filter((o) => o.parentOrderId === orderId)
        .map((o) => o.id);

      const idsToDelete = [orderId, ...childIds];

      const { error } = await supabase
        .from("orders")
        .update({ is_deleted: true })
        .in("id", idsToDelete);

      if (error) {
        console.error("[OrderStore] Soft delete error:", error);
        toast({ title: "Error deleting order", description: error.message, variant: "destructive" });
        return;
      }
      console.log("[OrderStore] Soft deleted:", idsToDelete);
      addLog({
        actionType: "Order Soft Deleted",
        userName,
        role: role || "unknown",
        entity: `Order #${orderId}`,
        details: childIds.length > 0 ? `Also deleted ${childIds.length} child order(s)` : undefined,
      });
    },
    [orders, addLog, userName, role, toast]
  );

  const restoreOrder = useCallback(
    async (orderId: string) => {
      console.log("[OrderStore] Restoring order:", orderId);
      const order = orders.find((o) => o.id === orderId);
      const childIds = orders
        .filter((o) => o.parentOrderId === orderId)
        .map((o) => o.id);

      const idsToRestore = [orderId, ...childIds];
      if (order?.parentOrderId) idsToRestore.push(order.parentOrderId);

      const { error } = await supabase
        .from("orders")
        .update({ is_deleted: false })
        .in("id", idsToRestore);

      if (error) {
        console.error("[OrderStore] Restore error:", error);
        toast({ title: "Error restoring order", description: error.message, variant: "destructive" });
        return;
      }
      console.log("[OrderStore] Restored:", idsToRestore);
      addLog({
        actionType: "Order Restored",
        userName,
        role: role || "unknown",
        entity: `Order #${orderId}`,
      });
    },
    [orders, addLog, userName, role, toast]
  );

  const hardDelete = useCallback(
    async (orderId: string) => {
      console.log("[OrderStore] Hard deleting order:", orderId);
      const childIds = orders
        .filter((o) => o.parentOrderId === orderId)
        .map((o) => o.id);

      const idsToDelete = [orderId, ...childIds];

      const { error } = await supabase
        .from("orders")
        .delete()
        .in("id", idsToDelete);

      if (error) {
        console.error("[OrderStore] Hard delete error:", error);
        toast({ title: "Error deleting order", description: error.message, variant: "destructive" });
        return;
      }
      console.log("[OrderStore] Permanently deleted:", idsToDelete);
      addLog({
        actionType: "Order Permanently Deleted",
        userName,
        role: role || "unknown",
        entity: `Order #${orderId}`,
      });
    },
    [orders, addLog, userName, role, toast]
  );

  const updateOrder = useCallback(
    async (updated: Order) => {
      console.log("[OrderStore] Updating order:", updated.id, updated);
      const { error } = await supabase
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
        .eq("id", updated.id);

      if (error) {
        console.error("[OrderStore] Update error:", error);
        toast({ title: "Error updating order", description: error.message, variant: "destructive" });
        return;
      }
      console.log("[OrderStore] Order updated successfully:", updated.id);
      addLog({
        actionType: "Order Edited",
        userName,
        role: role || "unknown",
        entity: `Order #${updated.id}`,
        details: `Updated order for ${updated.customerName}`,
      });
    },
    [addLog, userName, role, toast]
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
