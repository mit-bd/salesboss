import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { Order, FollowupHistoryEntry, UpsellEntry, RepeatOrderEntry, UpsellRecord, RepeatOrderRecord } from "@/types/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "./AuditLogContext";
import { useAuth } from "./AuthContext";
import { useToast } from "@/hooks/use-toast";

interface OrderStoreContextType {
  orders: Order[];
  deletedOrders: Order[];
  activeOrders: Order[];
  followupHistory: FollowupHistoryEntry[];
  upsellRecords: UpsellRecord[];
  repeatOrderRecords: RepeatOrderRecord[];
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
    upsellEntries: UpsellEntry[];
    repeatOrderEntries: RepeatOrderEntry[];
  }) => Promise<void>;
  editFollowup: (data: {
    followupId: string;
    note: string;
    problemsDiscussed: string;
  }) => Promise<void>;
  updateUpsellRecord: (id: string, data: { productId: string | null; productName: string; price: number; note: string }) => Promise<void>;
  deleteUpsellRecord: (id: string) => Promise<void>;
  addUpsellRecord: (followupId: string, data: { productId: string | null; productName: string; price: number; note: string }) => Promise<void>;
  updateRepeatOrderRecord: (id: string, data: { productId: string | null; productName: string; price: number; note: string }) => Promise<void>;
  deleteRepeatOrderRecord: (id: string) => Promise<void>;
  getOrderHistory: (orderId: string) => FollowupHistoryEntry[];
  getUpsellsForFollowup: (followupId: string) => UpsellRecord[];
  getRepeatOrdersForFollowup: (followupId: string) => RepeatOrderRecord[];
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
    invoiceId: row.invoice_id || row.id,
    currentStatus: row.current_status || "pending",
    itemDescription: row.item_description || "",
    productSku: row.product_sku || "",
    orderSequenceNumber: row.order_sequence_number || 0,
    generatedOrderId: row.generated_order_id || "",
    customerId: row.customer_id || "",
    updatedAt: row.updated_at || "",
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
    editedBy: row.edited_by || null,
    editedAt: row.edited_at || null,
  };
}

function mapUpsellRow(row: any): UpsellRecord {
  return {
    id: row.id,
    followupId: row.followup_id,
    productId: row.product_id,
    productName: row.product_name || "",
    price: Number(row.price) || 0,
    note: row.note || "",
    addedBy: row.added_by || null,
    createdAt: row.created_at || "",
  };
}

function mapRepeatRow(row: any): RepeatOrderRecord {
  return {
    id: row.id,
    followupId: row.followup_id,
    productId: row.product_id,
    productName: row.product_name || "",
    price: Number(row.price) || 0,
    note: row.note || "",
    childOrderId: row.child_order_id || null,
    addedBy: row.added_by || null,
    createdAt: row.created_at || "",
  };
}

export function OrderStoreProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [followupHistory, setFollowupHistory] = useState<FollowupHistoryEntry[]>([]);
  const [upsellRecords, setUpsellRecords] = useState<UpsellRecord[]>([]);
  const [repeatOrderRecords, setRepeatOrderRecords] = useState<RepeatOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { addLog } = useAuditLog();
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const isMounted = useRef(true);
  const projectId = profile?.project_id;

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const userName = profile?.full_name || user?.email || "Admin User";

  const fetchOrders = useCallback(async () => {
    if (role === "owner" || !projectId) { setLoading(false); return; }
    let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
    query = (query as any).eq("project_id", projectId);
    const { data, error } = await query;
    if (error) { console.error("[OrderStore] Fetch error:", error); return; }
    if (isMounted.current) { setOrders((data || []).map(mapRow)); setLoading(false); }
  }, [projectId]);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase.from("followup_history").select("*").order("step_number", { ascending: true });
    if (error) { console.error("[OrderStore] History fetch error:", error); return; }
    if (isMounted.current) setFollowupHistory((data || []).map(mapHistoryRow));
  }, []);

  const fetchUpsells = useCallback(async () => {
    const { data, error } = await (supabase.from as any)("upsell_records").select("*").order("created_at", { ascending: true });
    if (error) { console.error("[OrderStore] Upsell fetch error:", error); return; }
    if (isMounted.current) setUpsellRecords((data || []).map(mapUpsellRow));
  }, []);

  const fetchRepeats = useCallback(async () => {
    const { data, error } = await (supabase.from as any)("repeat_order_records").select("*").order("created_at", { ascending: true });
    if (error) { console.error("[OrderStore] Repeat fetch error:", error); return; }
    if (isMounted.current) setRepeatOrderRecords((data || []).map(mapRepeatRow));
  }, []);

  useEffect(() => {
    // Owner users don't belong to a project, skip data loading
    if (role === "owner" || !projectId) { setLoading(false); return; }

    fetchOrders();
    fetchHistory();
    fetchUpsells();
    fetchRepeats();

    const ordersChannel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        if (!isMounted.current) return;
        const newOrder = mapRow(payload.new);
        if ((payload.new as any).project_id !== projectId) return;
        setOrders((prev) => { if (prev.some((o) => o.id === newOrder.id)) return prev; return [newOrder, ...prev]; });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        if (!isMounted.current) return;
        const updated = mapRow(payload.new);
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, (payload) => {
        if (!isMounted.current) return;
        setOrders((prev) => prev.filter((o) => o.id !== (payload.old as any).id));
      })
      .subscribe();

    const historyChannel = supabase
      .channel("followup-history-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "followup_history" }, (payload) => {
        if (!isMounted.current) return;
        if (payload.eventType === "INSERT") {
          const entry = mapHistoryRow(payload.new);
          setFollowupHistory((prev) => { if (prev.some((h) => h.id === entry.id)) return prev; return [...prev, entry]; });
        } else if (payload.eventType === "UPDATE") {
          const updated = mapHistoryRow(payload.new);
          setFollowupHistory((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
        } else if (payload.eventType === "DELETE") {
          setFollowupHistory((prev) => prev.filter((h) => h.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    const upsellChannel = supabase
      .channel("upsell-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "upsell_records" }, (payload) => {
        if (!isMounted.current) return;
        if (payload.eventType === "INSERT") {
          const rec = mapUpsellRow(payload.new);
          setUpsellRecords((prev) => { if (prev.some((r) => r.id === rec.id)) return prev; return [...prev, rec]; });
        } else if (payload.eventType === "UPDATE") {
          const rec = mapUpsellRow(payload.new);
          setUpsellRecords((prev) => prev.map((r) => (r.id === rec.id ? rec : r)));
        } else if (payload.eventType === "DELETE") {
          setUpsellRecords((prev) => prev.filter((r) => r.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    const repeatChannel = supabase
      .channel("repeat-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "repeat_order_records" }, (payload) => {
        if (!isMounted.current) return;
        if (payload.eventType === "INSERT") {
          const rec = mapRepeatRow(payload.new);
          setRepeatOrderRecords((prev) => { if (prev.some((r) => r.id === rec.id)) return prev; return [...prev, rec]; });
        } else if (payload.eventType === "UPDATE") {
          const rec = mapRepeatRow(payload.new);
          setRepeatOrderRecords((prev) => prev.map((r) => (r.id === rec.id ? rec : r)));
        } else if (payload.eventType === "DELETE") {
          setRepeatOrderRecords((prev) => prev.filter((r) => r.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(historyChannel);
      supabase.removeChannel(upsellChannel);
      supabase.removeChannel(repeatChannel);
    };
  }, [projectId, fetchOrders, fetchHistory, fetchUpsells, fetchRepeats]);

  const activeOrders = orders.filter((o) => !o.isDeleted);
  const deletedOrders = orders.filter((o) => o.isDeleted);

  const getOrderHistory = useCallback(
    (orderId: string) => followupHistory.filter((h) => h.orderId === orderId).sort((a, b) => a.stepNumber - b.stepNumber),
    [followupHistory]
  );

  const getUpsellsForFollowup = useCallback(
    (followupId: string) => upsellRecords.filter((r) => r.followupId === followupId),
    [upsellRecords]
  );

  const getRepeatOrdersForFollowup = useCallback(
    (followupId: string) => repeatOrderRecords.filter((r) => r.followupId === followupId),
    [repeatOrderRecords]
  );

  const addOrder = useCallback(
    async (order: Omit<Order, "id">) => {
      const { data: customerId, error: customerError } = await supabase
        .rpc("find_or_create_customer", {
          p_name: order.customerName,
          p_mobile: order.mobile,
          p_address: order.address,
        });

      if (customerError) {
        console.error("[OrderStore] Customer upsert error:", customerError);
        toast({ title: "Error creating customer", description: customerError.message, variant: "destructive" });
        return;
      }

      // Also set project_id on customer
      if (projectId && customerId) {
        await (supabase.from("customers") as any).update({ project_id: projectId }).eq("id", customerId);
      }

      const insertPayload: any = {
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
        item_description: order.itemDescription || "",
        customer_id: customerId,
        project_id: projectId,
      };

      const { data, error } = await supabase
        .from("orders")
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error("[OrderStore] Create error:", error);
        toast({ title: "Error creating order", description: error.message, variant: "destructive" });
        return;
      }

      const newOrder = mapRow(data);
      setOrders((prev) => { if (prev.some((o) => o.id === newOrder.id)) return prev; return [newOrder, ...prev]; });
      toast({ title: "Order created" });
      addLog({ actionType: "Order Created", userName, role: role || "unknown", entity: `Order #${data.invoice_id}`, details: `Customer: ${order.customerName}` });
    },
    [addLog, user, userName, role, toast, projectId]
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
      nextFollowupDatetime?: string | null;
      upsellEntries: UpsellEntry[];
      repeatOrderEntries: RepeatOrderEntry[];
    }) => {
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

      const followupId = historyData.id;

      if (data.upsellEntries.length > 0) {
        const upsellRows = data.upsellEntries.map((e) => ({
          followup_id: followupId,
          product_id: e.productId || null,
          product_name: e.productName,
          price: e.price,
          note: e.note,
          added_by: user?.id || null,
        }));
        const { error: upsellError } = await (supabase.from as any)("upsell_records").insert(upsellRows);
        if (upsellError) console.error("[OrderStore] Upsell insert error:", upsellError);
      }

      const parentOrder = orders.find((o) => o.id === data.orderId);
      for (const entry of data.repeatOrderEntries) {
        const childPayload: any = {
          customer_name: parentOrder?.customerName || "",
          mobile: parentOrder?.mobile || "",
          address: parentOrder?.address || "",
          order_source: parentOrder?.orderSource || "Website",
          product_id: entry.productId || null,
          product_title: entry.productName,
          price: entry.price,
          note: entry.note,
          followup_step: 1,
          current_status: "pending",
          assigned_to: parentOrder?.assignedTo || null,
          assigned_to_name: parentOrder?.assignedToName || "",
          order_date: new Date().toISOString().split("T")[0],
          delivery_method: parentOrder?.deliveryMethod || "",
          parent_order_id: data.orderId,
          is_repeat: true,
          health: "new",
          created_by: user?.id,
          customer_id: parentOrder?.customerId || null,
          project_id: projectId,
        };
        const { data: childData, error: childError } = await supabase
          .from("orders")
          .insert(childPayload)
          .select()
          .single();

        if (childError) {
          console.error("[OrderStore] Repeat child order error:", childError);
          continue;
        }

        await (supabase.from as any)("repeat_order_records").insert({
          followup_id: followupId,
          product_id: entry.productId || null,
          product_name: entry.productName,
          price: entry.price,
          note: entry.note,
          child_order_id: childData.id,
          added_by: user?.id || null,
        });
      }

      const isFinalStep = data.stepNumber === 5;
      const updatePayload: any = {
        current_status: "completed",
        followup_date: data.nextFollowupDate || null,
        next_followup_datetime: data.nextFollowupDatetime || null,
      };
      if (isFinalStep) updatePayload.health = "good";

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

      const newHistoryEntry = mapHistoryRow(historyData);
      setFollowupHistory((prev) => { if (prev.some((h) => h.id === newHistoryEntry.id)) return prev; return [...prev, newHistoryEntry]; });

      const updatedOrder = mapRow(orderData);
      setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));

      toast({ title: `Step ${data.stepNumber} completed`, description: isFinalStep ? "Followup lifecycle fully completed!" : `Next followup on ${data.nextFollowupDate}` });
      addLog({ actionType: "Followup Completed", userName, role: role || "unknown", entity: `Order #${data.orderId}`, details: `Step ${data.stepNumber} completed${data.upsellEntries.length > 0 ? ` with ${data.upsellEntries.length} upsell(s)` : ""}${data.repeatOrderEntries.length > 0 ? `, ${data.repeatOrderEntries.length} repeat order(s)` : ""}` });
    },
    [user, userName, role, toast, addLog, orders, projectId]
  );

  const editFollowup = useCallback(
    async (data: { followupId: string; note: string; problemsDiscussed: string }) => {
      const { error } = await (supabase.from("followup_history").update as any)({
        note: data.note,
        problems_discussed: data.problemsDiscussed,
        edited_by: user?.id || null,
        edited_at: new Date().toISOString(),
      }).eq("id", data.followupId);

      if (error) {
        console.error("[OrderStore] Edit followup error:", error);
        toast({ title: "Error editing followup", description: error.message, variant: "destructive" });
        throw error;
      }

      setFollowupHistory((prev) =>
        prev.map((h) =>
          h.id === data.followupId
            ? { ...h, note: data.note, problemsDiscussed: data.problemsDiscussed, editedBy: user?.id || null, editedAt: new Date().toISOString() }
            : h
        )
      );

      toast({ title: "Followup record updated" });
      addLog({ actionType: "Followup Edited", userName, role: role || "unknown", entity: `Followup #${data.followupId}`, details: "Admin edited followup record" });
    },
    [user, userName, role, toast, addLog]
  );

  const softDelete = useCallback(
    async (orderId: string) => {
      const childIds = orders.filter((o) => o.parentOrderId === orderId).map((o) => o.id);
      const idsToDelete = [orderId, ...childIds];
      const { error } = await supabase.from("orders").update({ is_deleted: true }).in("id", idsToDelete);
      if (error) {
        console.error("[OrderStore] Soft delete error:", error);
        toast({ title: "Error deleting order", description: error.message, variant: "destructive" });
        return;
      }
      setOrders((prev) => prev.map((o) => idsToDelete.includes(o.id) ? { ...o, isDeleted: true } : o));
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
      const { error } = await supabase.from("orders").update({ is_deleted: false }).in("id", idsToRestore);
      if (error) {
        console.error("[OrderStore] Restore error:", error);
        toast({ title: "Error restoring order", description: error.message, variant: "destructive" });
        return;
      }
      setOrders((prev) => prev.map((o) => idsToRestore.includes(o.id) ? { ...o, isDeleted: false } : o));
      toast({ title: "Order restored" });
      addLog({ actionType: "Order Restored", userName, role: role || "unknown", entity: `Order #${orderId}` });
    },
    [orders, addLog, userName, role, toast]
  );

  const hardDelete = useCallback(
    async (orderId: string) => {
      const childIds = orders.filter((o) => o.parentOrderId === orderId).map((o) => o.id);
      const idsToDelete = [orderId, ...childIds];
      const { error } = await supabase.from("orders").delete().in("id", idsToDelete);
      if (error) {
        console.error("[OrderStore] Hard delete error:", error);
        toast({ title: "Error deleting order", description: error.message, variant: "destructive" });
        return;
      }
      setOrders((prev) => prev.filter((o) => !idsToDelete.includes(o.id)));
      toast({ title: "Order permanently deleted" });
      addLog({ actionType: "Order Permanently Deleted", userName, role: role || "unknown", entity: `Order #${orderId}` });
    },
    [orders, addLog, userName, role, toast]
  );

  const updateOrder = useCallback(
    async (updated: Order) => {
      let query = supabase
        .from("orders")
        .update({
          customer_name: updated.customerName, mobile: updated.mobile, address: updated.address,
          order_source: updated.orderSource, product_id: updated.productId || null,
          product_title: updated.productTitle, price: updated.price, note: updated.note,
          followup_step: updated.followupStep, followup_date: updated.followupDate || null,
          assigned_to: updated.assignedTo || null, assigned_to_name: updated.assignedToName,
          order_date: updated.orderDate, delivery_date: updated.deliveryDate || null,
          delivery_method: updated.deliveryMethod, health: updated.health,
          current_status: updated.currentStatus || "pending",
        })
        .eq("id", updated.id);

      if (updated.updatedAt) {
        query = query.eq("updated_at", updated.updatedAt);
      }

      const { data, error } = await query.select().single();

      if (error) {
        if (error.code === "PGRST116" && updated.updatedAt) {
          console.warn("[OrderStore] Concurrency conflict detected for order:", updated.id);
          toast({
            title: "Conflict Detected",
            description: "This order has been updated by another user. Please reload.",
            variant: "destructive",
          });
          throw new Error("CONCURRENCY_CONFLICT");
        }
        console.error("[OrderStore] Update error:", error);
        toast({ title: "Error updating order", description: error.message, variant: "destructive" });
        throw error;
      }
      if (data) {
        const confirmed = mapRow(data);
        setOrders((list) => list.map((o) => (o.id === confirmed.id ? confirmed : o)));
      }
      toast({ title: "Order updated" });
      addLog({ actionType: "Order Edited", userName, role: role || "unknown", entity: `Order #${updated.id}`, details: `Updated order for ${updated.customerName}` });
    },
    [addLog, userName, role, toast]
  );

  const updateUpsellRecord = useCallback(
    async (id: string, data: { productId: string | null; productName: string; price: number; note: string }) => {
      const { error } = await (supabase.from as any)("upsell_records").update({
        product_id: data.productId,
        product_name: data.productName,
        price: data.price,
        note: data.note,
      }).eq("id", id);
      if (error) { toast({ title: "Error updating upsell", description: error.message, variant: "destructive" }); throw error; }
      setUpsellRecords((prev) => prev.map((r) => r.id === id ? { ...r, ...data } : r));
      toast({ title: "Upsell record updated" });
      addLog({ actionType: "Upsell Edited", userName, role: role || "unknown", entity: `Upsell #${id}`, details: `Product: ${data.productName}` });
    },
    [toast, addLog, userName, role]
  );

  const deleteUpsellRecord = useCallback(
    async (id: string) => {
      const { error } = await (supabase.from as any)("upsell_records").delete().eq("id", id);
      if (error) { toast({ title: "Error deleting upsell", description: error.message, variant: "destructive" }); throw error; }
      setUpsellRecords((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Upsell record deleted" });
      addLog({ actionType: "Upsell Deleted", userName, role: role || "unknown", entity: `Upsell #${id}` });
    },
    [toast, addLog, userName, role]
  );

  const addUpsellRecord = useCallback(
    async (followupId: string, data: { productId: string | null; productName: string; price: number; note: string }) => {
      const { data: newRec, error } = await (supabase.from as any)("upsell_records").insert({
        followup_id: followupId,
        product_id: data.productId,
        product_name: data.productName,
        price: data.price,
        note: data.note,
        added_by: user?.id || null,
      }).select().single();
      if (error) { toast({ title: "Error adding upsell", description: error.message, variant: "destructive" }); throw error; }
      setUpsellRecords((prev) => [...prev, mapUpsellRow(newRec)]);
      toast({ title: "Upsell record added" });
      addLog({ actionType: "Upsell Added", userName, role: role || "unknown", entity: `Followup #${followupId}`, details: `Product: ${data.productName}` });
    },
    [user, toast, addLog, userName, role]
  );

  const updateRepeatOrderRecord = useCallback(
    async (id: string, data: { productId: string | null; productName: string; price: number; note: string }) => {
      const record = repeatOrderRecords.find((r) => r.id === id);
      const { error } = await (supabase.from as any)("repeat_order_records").update({
        product_id: data.productId,
        product_name: data.productName,
        price: data.price,
        note: data.note,
      }).eq("id", id);
      if (error) { toast({ title: "Error updating repeat order", description: error.message, variant: "destructive" }); throw error; }
      if (record?.childOrderId) {
        await supabase.from("orders").update({
          product_id: data.productId || null,
          product_title: data.productName,
          price: data.price,
          note: data.note,
        }).eq("id", record.childOrderId);
      }
      setRepeatOrderRecords((prev) => prev.map((r) => r.id === id ? { ...r, ...data } : r));
      toast({ title: "Repeat order record updated" });
      addLog({ actionType: "Repeat Order Edited", userName, role: role || "unknown", entity: `Repeat #${id}`, details: `Product: ${data.productName}` });
    },
    [repeatOrderRecords, toast, addLog, userName, role]
  );

  const deleteRepeatOrderRecord = useCallback(
    async (id: string) => {
      const record = repeatOrderRecords.find((r) => r.id === id);
      const { error } = await (supabase.from as any)("repeat_order_records").delete().eq("id", id);
      if (error) { toast({ title: "Error deleting repeat order", description: error.message, variant: "destructive" }); throw error; }
      if (record?.childOrderId) {
        await supabase.from("orders").update({ is_deleted: true }).eq("id", record.childOrderId);
      }
      setRepeatOrderRecords((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Repeat order record deleted" });
      addLog({ actionType: "Repeat Order Deleted", userName, role: role || "unknown", entity: `Repeat #${id}` });
    },
    [repeatOrderRecords, toast, addLog, userName, role]
  );

  return (
    <OrderStoreContext.Provider
      value={{
        orders, deletedOrders, activeOrders, followupHistory,
        upsellRecords, repeatOrderRecords, loading,
        softDelete, restoreOrder, hardDelete, updateOrder, addOrder,
        completeFollowup, editFollowup, getOrderHistory,
        getUpsellsForFollowup, getRepeatOrdersForFollowup,
        updateUpsellRecord, deleteUpsellRecord, addUpsellRecord,
        updateRepeatOrderRecord, deleteRepeatOrderRecord,
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
