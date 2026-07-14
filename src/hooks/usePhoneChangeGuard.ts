import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PhoneCheckResult {
  status: "same" | "new_number" | "collision";
  existingCustomerId?: string;
  existingCustomerName?: string;
  existingOrderCount?: number;
}

// Checks whether changing a customer's phone would collide with an existing customer
// in the same project. Never mutates data — caller must decide the next step.
export function usePhoneChangeGuard() {
  return useCallback(async (params: {
    projectId: string;
    currentMobile: string;
    newMobile: string;
  }): Promise<PhoneCheckResult> => {
    const { projectId, currentMobile, newMobile } = params;
    if (!newMobile || newMobile.trim() === currentMobile.trim()) {
      return { status: "same" };
    }
    const { data: existing } = await supabase
      .from("customers")
      .select("id,name,total_orders")
      .eq("project_id", projectId)
      .eq("mobile_number", newMobile.trim())
      .maybeSingle();
    if (existing) {
      return {
        status: "collision",
        existingCustomerId: (existing as any).id,
        existingCustomerName: (existing as any).name,
        existingOrderCount: (existing as any).total_orders,
      };
    }
    return { status: "new_number" };
  }, []);
}
