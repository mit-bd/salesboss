import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ImportTemplate {
  id: string;
  name: string;
  source_hint: string | null;
  header_signature: string[];
  mapping: Record<string, string>;
  usage_count: number;
  created_at: string;
}

export function useImportTemplates() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profile?.project_id) { setTemplates([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("import_mapping_templates")
      .select("*")
      .eq("project_id", profile.project_id)
      .order("usage_count", { ascending: false });
    if (!error && data) setTemplates(data as any as ImportTemplate[]);
    setLoading(false);
  }, [profile?.project_id]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveTemplate = useCallback(
    async (input: { name: string; source_hint?: string; header_signature: string[]; mapping: Record<string, string> }) => {
      if (!profile?.project_id) throw new Error("No project");
      const { error } = await supabase.from("import_mapping_templates").insert({
        project_id: profile.project_id,
        name: input.name,
        source_hint: input.source_hint ?? null,
        header_signature: input.header_signature,
        mapping: input.mapping,
      });
      if (error) throw error;
      await refresh();
    },
    [profile?.project_id, refresh]
  );

  const renameTemplate = useCallback(
    async (id: string, name: string) => {
      const { error } = await supabase.from("import_mapping_templates").update({ name }).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("import_mapping_templates").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  const bumpUsage = useCallback(async (id: string, current: number) => {
    await supabase.from("import_mapping_templates").update({ usage_count: current + 1 }).eq("id", id);
  }, []);

  return { templates, loading, refresh, saveTemplate, renameTemplate, deleteTemplate, bumpUsage };
}
