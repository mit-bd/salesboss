import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FollowupProblem {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

export interface QuickInfoField {
  id: string;
  label: string;
  field_type: string;
  options: string[];
  is_active: boolean;
  sort_order: number;
}

export function useFollowupProblems() {
  const [problems, setProblems] = useState<FollowupProblem[]>([]);
  const [quickInfoFields, setQuickInfoFields] = useState<QuickInfoField[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [pRes, qRes] = await Promise.all([
      (supabase.from as any)("followup_problems").select("*").eq("is_active", true).order("sort_order"),
      (supabase.from as any)("followup_quick_info_fields").select("*").eq("is_active", true).order("sort_order"),
    ]);
    setProblems((pRes.data || []) as FollowupProblem[]);
    setQuickInfoFields(
      ((qRes.data || []) as any[]).map((f: any) => ({
        ...f,
        options: Array.isArray(f.options) ? f.options : [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const addProblem = async (label: string, projectId?: string | null) => {
    const maxSort = problems.length > 0 ? Math.max(...problems.map((p) => p.sort_order)) : 0;
    const { error } = await (supabase.from as any)("followup_problems").insert({
      label,
      sort_order: maxSort + 1,
      project_id: projectId || null,
    });
    if (!error) await fetch();
    return error;
  };

  const updateProblem = async (id: string, label: string) => {
    const { error } = await (supabase.from as any)("followup_problems").update({ label }).eq("id", id);
    if (!error) await fetch();
    return error;
  };

  const deleteProblem = async (id: string) => {
    const { error } = await (supabase.from as any)("followup_problems").delete().eq("id", id);
    if (!error) await fetch();
    return error;
  };

  const addQuickInfoField = async (label: string, fieldType: string, options: string[], projectId?: string | null) => {
    const maxSort = quickInfoFields.length > 0 ? Math.max(...quickInfoFields.map((f) => f.sort_order)) : 0;
    const { error } = await (supabase.from as any)("followup_quick_info_fields").insert({
      label,
      field_type: fieldType,
      options: JSON.stringify(options),
      sort_order: maxSort + 1,
      project_id: projectId || null,
    });
    if (!error) await fetch();
    return error;
  };

  const deleteQuickInfoField = async (id: string) => {
    const { error } = await (supabase.from as any)("followup_quick_info_fields").delete().eq("id", id);
    if (!error) await fetch();
    return error;
  };

  return {
    problems,
    quickInfoFields,
    loading,
    addProblem,
    updateProblem,
    deleteProblem,
    addQuickInfoField,
    deleteQuickInfoField,
    refresh: fetch,
  };
}
