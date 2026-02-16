import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const fetchMembers = useCallback(async () => {
    // Fetch user_roles with profiles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("[useTeamMembers] Roles fetch error:", rolesError);
      setLoading(false);
      return;
    }

    if (!roles || roles.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name");

    if (profilesError) {
      console.error("[useTeamMembers] Profiles fetch error:", profilesError);
    }

    const profileMap = new Map<string, string>();
    (profiles || []).forEach((p: any) => {
      profileMap.set(p.user_id, p.full_name || "");
    });

    const teamMembers: TeamMember[] = roles.map((r: any) => ({
      id: r.user_id,
      userId: r.user_id,
      name: profileMap.get(r.user_id) || "Unknown",
      email: "",
      role: r.role,
    }));

    setMembers(teamMembers);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const executives = members.filter((m) => m.role === "sales_executive" || m.role === "sub_admin");
  const allAssignable = members;

  return { members, executives, allAssignable, loading, refresh: fetchMembers };
}
