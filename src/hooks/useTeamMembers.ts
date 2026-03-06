import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const projectId = profile?.project_id;

  const fetchMembers = useCallback(async () => {
    if (!projectId) { setMembers([]); setLoading(false); return; }

    // Fetch profiles in the same project
    const { data: profiles, error: profilesError } = await (supabase.from("profiles") as any)
      .select("user_id, full_name")
      .eq("project_id", projectId);

    if (profilesError) {
      console.error("[useTeamMembers] Profiles fetch error:", profilesError);
      setLoading(false);
      return;
    }

    if (!profiles || profiles.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const userIds = profiles.map((p: any) => p.user_id);

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    if (rolesError) {
      console.error("[useTeamMembers] Roles fetch error:", rolesError);
      setLoading(false);
      return;
    }

    const roleMap = new Map<string, string>();
    (roles || []).forEach((r: any) => { roleMap.set(r.user_id, r.role); });

    const profileMap = new Map<string, string>();
    profiles.forEach((p: any) => { profileMap.set(p.user_id, p.full_name || ""); });

    const teamMembers: TeamMember[] = userIds
      .filter((uid: string) => roleMap.has(uid))
      .map((uid: string) => ({
        id: uid,
        userId: uid,
        name: profileMap.get(uid) || "Unknown",
        email: "",
        role: roleMap.get(uid) || "",
      }));

    setMembers(teamMembers);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const executives = members.filter((m) => m.role === "sales_executive" || m.role === "sub_admin");
  const allAssignable = members;

  return { members, executives, allAssignable, loading, refresh: fetchMembers };
}
