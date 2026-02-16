import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { Order, FollowupHistoryEntry } from "@/types/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "./AuditLogContext";
import { useAuth } from "./AuthContext";
import { useToast } from "@/hooks/use-toast";

interface OrderStoreContextType {
  orders: Order[];
  deletedOrders: Order[];
  activeOrders: Order[];
  followupHistory: FollowupHistoryEntry[];
  loading: boolean;
  softDelete: (orderId: string) => Promise<void>;
  restoreOrder: (orderId: string) => Promise<void>;
  hardDelete: (orderId: string) => Promise<void>;
  updateOrder: (updated: Order) => Promise<void>;
  addOrder: (order: Omit<Order, "id">) => Promise<void>;
  completeFollowup: (data: {
    orderId: string;
    stepNumber: number;
    note: string;
    problemsDiscussed: string;
    upsellAttempted: boolean;
    upsellDetails: string;
    nextFollowupDate: string | null;
  }) => Promise<void>;
  getOrderHistory: (orderId: string) => FollowupHistoryEntry[];
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
    currentStatus: row.current_status || "pending",
  };
}

function mapHistoryRow(row: any): FollowupHistoryEntry {
  return {
    id: row.id,
    orderId: row.order_id,
    stepNumber: row.step_number,
    note: row.note || "",
    problemsDiscussed: row.problems_discussed || "",
    upsellAttempted: row.upsell_attempted || false,
    upsellDetails: row.upsell_details || "",
    nextFollowupDate: row.next_followup_date || null,
    completedBy: row.completed_by || null,
    completedByName: row.completed_by_name || "",
    completedAt: row.completed_at || "",
  };
}

export function OrderStoreProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [followupHistory, setFollowupHistory] = useState<FollowupHistoryEntry[]>([]);
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

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("followup_history")
      .select("*")
      .order("step_number", { ascending: true });

    if (error) {
      console.error("[OrderStore] History fetch error:", error);
      return;
    }
    if (isMounted.current) {
      setFollowupHistory((data || []).map(mapHistoryRow));
    }
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    fetchOrders();
    fetchHistory();

    const ordersChannel = supabase
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

    const historyChannel = supabase
      .channel("followup-history-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "followup_history" }, (payload) => {
        if (!isMounted.current) return;
        const entry = mapHistoryRow(payload.new);
        setFollowupHistory((prev) => {
          if (prev.some((h) => h.id === entry.id)) return prev;
          return [...prev, entry];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "followup_history" }, (payload) => {
        if (!isMounted.current) return;
        const updated = mapHistoryRow(payload.new);
        setFollowupHistory((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "followup_history" }, (payload) => {
        if (!isMounted.current) return;
        const deletedId = (payload.old as any).id;
        setFollowupHistory((prev) => prev.filter((h) => h.id !== deletedId));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [fetchOrders, fetchHistory]);

  const activeOrders = orders.filter((o) => !o.isDeleted);
  const deletedOrders = orders.filter((o) => o.isDeleted);

  const getOrderHistory = useCallback(
    (orderId: string) => followupHistory.filter((h) => h.orderId === orderId).sort((a, b) => a.stepNumber - b.stepNumber),
    [followupHistory]
  );

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
          current_status: "pending",
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

  const completeFollowup = useCallback(
    async (data: {
      orderId: string;
      stepNumber: number;
      note: string;
      problemsDiscussed: string;
      upsellAttempted: boolean;
      upsellDetails: string;
      nextFollowupDate: string | null;
    }) => {
      // 1. Insert followup history record
      const { data: historyData, error: historyError } = await supabase
        .from("followup_history")
        .insert({
          order_id: data.orderId,
          step_number: data.stepNumber,
          note: data.note,
          problems_discussed: data.problemsDiscussed,
          upsell_attempted: data.upsellAttempted,
          upsell_details: data.upsellDetails,
          next_followup_date: data.nextFollowupDate || null,
          completed_by: user?.id || null,
          completed_by_name: userName,
        })
        .select()
        .single();

      if (historyError) {
        console.error("[OrderStore] Complete followup error:", historyError);
        toast({ title: "Error completing followup", description: historyError.message, variant: "destructive" });
        throw historyError;
      }

      // 2. Update order status to completed
      const isFinalStep = data.stepNumber === 5;
      const updatePayload: any = {
        current_status: "completed",
        followup_date: data.nextFollowupDate || null,
      };

      // If final step, mark health as good
      if (isFinalStep) {
        updatePayload.health = "good";
      }

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", data.orderId)
        .select()
        .single();

      if (orderError) {
        console.error("[OrderStore] Update order after followup error:", orderError);
        toast({ title: "Error updating order", description: orderError.message, variant: "destructive" });
        throw orderError;
      }

      // Optimistic local updates
      const newHistoryEntry = mapHistoryRow(historyData);
      setFollowupHistory((prev) => {
        if (prev.some((h) => h.id === newHistoryEntry.id)) return prev;
        return [...prev, newHistoryEntry];
      });

      const updatedOrder = mapRow(orderData);
      setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));

      toast({ title: `Step ${data.stepNumber} completed`, description: isFinalStep ? "Followup lifecycle fully completed!" : `Next followup on ${data.nextFollowupDate}` });
      addLog({
        actionType: "Followup Completed",
        userName,
        role: role || "unknown",
        entity: `Order #${data.orderId}`,
        details: `Step ${data.stepNumber} completed`,
      });
    },
    [user, userName, role, toast, addLog]
  );

  const softDelete = useCallback(
    async (orderId: string) => {
      const childIds = orders.filter((o) => o.parentOrderId === orderId).map((o) => o.id);
      const idsToDelete = [orderId, ...childIds];

      setOrders((prev) => prev.map((o) => idsToDelete.includes(o.id) ? { ...o, isDeleted: true } : o));

      const { error } = await supabase
        .from("orders")
        .update({ is_deleted: true })
        .in("id", idsToDelete);

      if (error) {
        console.error("[OrderStore] Soft delete error:", error);
        toast({ title: "Error deleting order", description: error.message, variant: "destructive" });
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

      const backup = orders.filter((o) => idsToDelete.includes(o.id));
      setOrders((prev) => prev.filter((o) => !idsToDelete.includes(o.id)));

      const { error } = await supabase
        .from("orders")
        .delete()
        .in("id", idsToDelete);

      if (error) {
        console.error("[OrderStore] Hard delete error:", error);
        toast({ title: "Error deleting order", description: error.message, variant: "destructive" });
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
          current_status: updated.currentStatus || "pending",
        })
        .eq("id", updated.id)
        .select()
        .single();

      if (error) {
        console.error("[OrderStore] Update error:", error);
        toast({ title: "Error updating order", description: error.message, variant: "destructive" });
        if (prev) setOrders((list) => list.map((o) => (o.id === updated.id ? prev : o)));
        return;
      }

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
      value={{
        orders,
        deletedOrders,
        activeOrders,
        followupHistory,
        loading,
        softDelete,
        restoreOrder,
        hardDelete,
        updateOrder,
        addOrder,
        completeFollowup,
        getOrderHistory,
        refreshOrders: fetchOrders,
      }}
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
