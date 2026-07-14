import { useMemo } from "react";
import { useCustomerOrders, type CustomerOrderRow } from "@/hooks/useCustomerOrders";
import { daysBetween } from "@/lib/bst";

export interface OrderPosition {
  loading: boolean;
  orders: CustomerOrderRow[];
  index: number;            // 0-based position of current order in chronological (oldest→newest) list
  position: number;         // 1-based index for display
  total: number;
  isFirstOrder: boolean;
  isOnlyOrder: boolean;
  isRepeatCustomer: boolean;
  firstOrderDate: string | null;
  latestOrderDate: string | null;
  daysSinceFirst: number | null;
  daysSinceLast: number | null;
  prevOrderId: string | null; // previous chronological order (older)
  nextOrderId: string | null; // next chronological order (newer)
}

/**
 * Derives order-position intelligence for the workspace header.
 * Chronological order = oldest first; navigation prev = older, next = newer.
 */
export function useOrderPosition(customerId: string | undefined, currentOrderId: string | undefined): OrderPosition {
  const { orders: descOrders, loading } = useCustomerOrders(customerId);

  return useMemo(() => {
    const chrono = [...descOrders].reverse(); // oldest → newest
    const total = chrono.length;
    const idx = currentOrderId ? chrono.findIndex((o) => o.id === currentOrderId) : -1;
    const first = chrono[0] || null;
    const last = chrono[chrono.length - 1] || null;

    return {
      loading,
      orders: chrono,
      index: idx,
      position: idx >= 0 ? idx + 1 : 0,
      total,
      isFirstOrder: total <= 1 || idx === 0,
      isOnlyOrder: total === 1,
      isRepeatCustomer: total > 1,
      firstOrderDate: first?.order_date || first?.created_at?.split("T")[0] || null,
      latestOrderDate: last?.order_date || last?.created_at?.split("T")[0] || null,
      daysSinceFirst: daysBetween(first?.order_date || first?.created_at || null),
      daysSinceLast: daysBetween(last?.order_date || last?.created_at || null),
      prevOrderId: idx > 0 ? chrono[idx - 1].id : null,
      nextOrderId: idx >= 0 && idx < total - 1 ? chrono[idx + 1].id : null,
    };
  }, [descOrders, currentOrderId, loading]);
}
