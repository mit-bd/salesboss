import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrderStore } from "@/contexts/OrderStoreContext";

export interface BulkConflictState {
  hasConflict: boolean;
  conflictIds: Set<string>;
  message: string;
}

const EMPTY_STATE: BulkConflictState = {
  hasConflict: false,
  conflictIds: new Set(),
  message: "",
};

/**
 * Builds a version map { orderId: updated_at } for optimistic locking.
 * Fetches current updated_at from the local order store state.
 */
export function useBulkConflict() {
  const [conflict, setConflict] = useState<BulkConflictState>(EMPTY_STATE);
  const { orders } = useOrderStore();

  const buildVersionMap = useCallback(
    (ids: string[]): Record<string, string> => {
      const map: Record<string, string> = {};
      for (const id of ids) {
        const order = orders.find((o) => o.id === id);
        if (order?.updatedAt) {
          map[id] = order.updatedAt;
        }
      }
      return map;
    },
    [orders]
  );

  const clearConflict = useCallback(() => setConflict(EMPTY_STATE), []);

  const handleConflictResponse = useCallback(
    (result: { success: boolean; conflict_ids: string[]; affected_count: number }) => {
      if (!result.success && result.conflict_ids?.length > 0) {
        setConflict({
          hasConflict: true,
          conflictIds: new Set(result.conflict_ids),
          message: `${result.conflict_ids.length} record(s) were modified by another user. Entire batch was aborted — no records updated.`,
        });
        return true; // conflict detected
      }
      return false; // no conflict
    },
    []
  );

  return {
    conflict,
    buildVersionMap,
    handleConflictResponse,
    clearConflict,
  };
}
