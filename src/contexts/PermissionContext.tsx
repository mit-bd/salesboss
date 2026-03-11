import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PermissionContextType {
  permissions: string[];
  loading: boolean;
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (...keys: string[]) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType>({
  permissions: [],
  loading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  refreshPermissions: async () => {},
});

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!role) { setPermissions([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase.from as any)("role_permissions")
      .select("permission_key")
      .eq("role", role);
    if (error) { console.error("[Permissions] Fetch error:", error); setLoading(false); return; }
    setPermissions((data || []).map((r: any) => r.permission_key));
    setLoading(false);
  }, [role]);

  useEffect(() => {
    setLoading(true);
    fetchPermissions();

    const channel = supabase
      .channel("role-permissions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "role_permissions" }, () => {
        fetchPermissions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (key: string) => permissions.includes(key),
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (...keys: string[]) => keys.some((k) => permissions.includes(k)),
    [permissions]
  );

  return (
    <PermissionContext.Provider value={{ permissions, loading, hasPermission, hasAnyPermission, refreshPermissions: fetchPermissions }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
