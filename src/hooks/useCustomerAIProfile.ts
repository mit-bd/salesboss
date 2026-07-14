import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerAIProfile {
  id: string;
  customer_id: string;
  project_id: string;
  personality: string | null;
  buying_behaviour: string | null;
  purchase_pattern: string | null;
  repeat_pattern: string | null;
  price_sensitivity: string | null;
  product_preference: string | null;
  preferred_language: string | null;
  preferred_call_time: string | null;
  preferred_executive_id: string | null;
  preferred_payment: string | null;
  preferred_courier: string | null;
  loyalty_score: number | null;
  lifetime_trend: string | null;
  ai_confidence: number | null;
  evidence: Record<string, string> | null;
  locked_fields: string[];
  dirty: boolean;
  last_refreshed_at: string | null;
  model: string | null;
  updated_at: string;
}

export function useCustomerAIProfile(customerId: string | undefined) {
  const [profile, setProfile] = useState<CustomerAIProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true); setError(null);
    const { data, error: err } = await supabase
      .from("customer_ai_profiles").select("*")
      .eq("customer_id", customerId).maybeSingle();
    if (err) setError(err.message);
    setProfile((data as any) ?? null);
    setLoading(false);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async (force = true) => {
    if (!customerId) return;
    setRefreshing(true); setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("ai-customer-profile", {
        body: { customer_id: customerId, force },
      });
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.profile) setProfile((data as any).profile as CustomerAIProfile);
    } catch (e: any) {
      setError(e?.message ?? "Failed to refresh AI profile");
    } finally {
      setRefreshing(false);
    }
  }, [customerId]);

  // Auto-refresh if stale or dirty
  useEffect(() => {
    if (!profile) return;
    const stale = !profile.last_refreshed_at ||
      (Date.now() - new Date(profile.last_refreshed_at).getTime()) > 24 * 60 * 60 * 1000;
    if (profile.dirty || stale) {
      refresh(false);
    }
     
  }, [profile?.id]);

  const toggleLock = useCallback(async (field: string) => {
    if (!profile) return;
    const next = profile.locked_fields.includes(field)
      ? profile.locked_fields.filter((f) => f !== field)
      : [...profile.locked_fields, field];
    const { data, error: err } = await supabase
      .from("customer_ai_profiles")
      .update({ locked_fields: next })
      .eq("id", profile.id).select().maybeSingle();
    if (err) { setError(err.message); return; }
    if (data) setProfile(data as any);
  }, [profile]);

  return { profile, loading, refreshing, error, refresh, toggleLock, reload: load };
}
