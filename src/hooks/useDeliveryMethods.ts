import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DeliveryMethod {
  id: string;
  name: string;
  contactInfo: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
}

interface UseDeliveryMethodsOptions {
  activeOnly?: boolean;
}

export function useDeliveryMethods(options: UseDeliveryMethodsOptions = {}) {
  const [methods, setMethods] = useState<DeliveryMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const projectId = profile?.project_id;

  const mapRow = (row: any): DeliveryMethod => ({
    id: row.id,
    name: row.name,
    contactInfo: row.contact_info || "",
    notes: row.notes || "",
    isActive: row.is_active,
    createdAt: row.created_at,
  });

  const fetchMethods = async () => {
    if (!projectId) { setLoading(false); return; }
    let query = (supabase.from as any)("delivery_methods").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
    if (options.activeOnly) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (!error && data) {
      setMethods(data.map(mapRow));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    fetchMethods();

    const channel = supabase
      .channel("delivery_methods_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_methods" }, () => {
        fetchMethods();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.activeOnly, projectId]);

  const addMethod = async (data: { name: string; contactInfo: string; notes: string }) => {
    const { error } = await (supabase.from as any)("delivery_methods").insert({
      name: data.name,
      contact_info: data.contactInfo,
      notes: data.notes,
      project_id: projectId,
    });
    return { error };
  };

  const updateMethod = async (id: string, data: Partial<{ name: string; contactInfo: string; notes: string; isActive: boolean }>) => {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.contactInfo !== undefined) payload.contact_info = data.contactInfo;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.isActive !== undefined) payload.is_active = data.isActive;
    const { error } = await (supabase.from as any)("delivery_methods").update(payload).eq("id", id);
    return { error };
  };

  return { methods, loading, addMethod, updateMethod, refetch: fetchMethods };
}
