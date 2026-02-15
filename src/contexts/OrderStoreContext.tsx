import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Order } from "@/types/data";
import { mockOrders as initialOrders } from "@/data/mockData";
import { useAuditLog } from "./AuditLogContext";

interface OrderStoreContextType {
  orders: Order[];
  deletedOrders: Order[];
  activeOrders: Order[];
  softDelete: (orderId: string) => void;
  restoreOrder: (orderId: string) => void;
  hardDelete: (orderId: string) => void;
  updateOrder: (updated: Order) => void;
}

const OrderStoreContext = createContext<OrderStoreContextType | null>(null);

export function OrderStoreProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders.map((o) => ({ ...o })));
  const [deletedOrderIds, setDeletedOrderIds] = useState<Set<string>>(new Set());
  const { addLog } = useAuditLog();

  const activeOrders = orders.filter((o) => !deletedOrderIds.has(o.id));
  const deletedOrders = orders.filter((o) => deletedOrderIds.has(o.id));

  const softDelete = useCallback(
    (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      const childIds = orders
        .filter((o) => o.parentOrderId === orderId)
        .map((o) => o.id);
      setDeletedOrderIds((prev) => {
        const next = new Set(prev);
        next.add(orderId);
        childIds.forEach((id) => next.add(id));
        return next;
      });
      addLog({
        actionType: "Order Soft Deleted",
        userName: "Admin User",
        role: "admin",
        entity: `Order #${orderId}`,
        details: childIds.length > 0 ? `Also deleted ${childIds.length} child order(s)` : undefined,
      });
    },
    [orders, addLog]
  );

  const restoreOrder = useCallback(
    (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      const childIds = orders
        .filter((o) => o.parentOrderId === orderId)
        .map((o) => o.id);
      setDeletedOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        childIds.forEach((id) => next.delete(id));
        // Also restore parent if this is a child
        if (order.parentOrderId) next.delete(order.parentOrderId);
        return next;
      });
      addLog({
        actionType: "Order Restored",
        userName: "Admin User",
        role: "admin",
        entity: `Order #${orderId}`,
        details: childIds.length > 0 ? `Also restored ${childIds.length} child order(s)` : undefined,
      });
    },
    [orders, addLog]
  );

  const hardDelete = useCallback(
    (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      const childIds = orders
        .filter((o) => o.parentOrderId === orderId)
        .map((o) => o.id);
      setOrders((prev) =>
        prev.filter((o) => o.id !== orderId && !childIds.includes(o.id))
      );
      setDeletedOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        childIds.forEach((id) => next.delete(id));
        return next;
      });
      addLog({
        actionType: "Order Permanently Deleted",
        userName: "Admin User",
        role: "admin",
        entity: `Order #${orderId}`,
      });
    },
    [orders, addLog]
  );

  const updateOrder = useCallback(
    (updated: Order) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? updated : o))
      );
      addLog({
        actionType: "Order Edited",
        userName: "Admin User",
        role: "admin",
        entity: `Order #${updated.id}`,
        details: `Updated order for ${updated.customerName}`,
      });
    },
    [addLog]
  );

  return (
    <OrderStoreContext.Provider
      value={{ orders, deletedOrders, activeOrders, softDelete, restoreOrder, hardDelete, updateOrder }}
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
