import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Save, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Permission {
  key: string;
  category: string;
  label: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sub_admin: "Sub Admin",
  sales_executive: "Sales Executive",
};

const SYSTEM_ROLES = ["admin", "sub_admin", "sales_executive"];

export default function RolesPage() {
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addLog } = useAuditLog();
  const { profile, role: userRole } = useAuth();
  const userName = profile?.full_name || "Admin User";

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [savedPermissions, setSavedPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState("sub_admin");
  const [dirty, setDirty] = useState(false);

  const fetchData = useCallback(async () => {
    const [permsRes, rpRes] = await Promise.all([
      (supabase.from as any)("permissions").select("*").order("category"),
      (supabase.from as any)("role_permissions").select("*"),
    ]);

    if (permsRes.error) { console.error(permsRes.error); return; }
    if (rpRes.error) { console.error(rpRes.error); return; }

    setPermissions(permsRes.data.map((r: any) => ({ key: r.key, category: r.category, label: r.label })));

    const grouped: Record<string, string[]> = {};
    for (const rp of rpRes.data) {
      if (!grouped[rp.role]) grouped[rp.role] = [];
      grouped[rp.role].push(rp.permission_key);
    }
    setRolePermissions({ ...grouped });
    setSavedPermissions(JSON.parse(JSON.stringify(grouped)));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute dirty by comparing current vs saved for selected role
  const computeDirty = (current: string[], role: string) => {
    const saved = savedPermissions[role] || [];
    return JSON.stringify([...current].sort()) !== JSON.stringify([...saved].sort());
  };

  useEffect(() => {
    setDirty(computeDirty(rolePermissions[selectedRole] || [], selectedRole));
  }, [selectedRole]);

  // Cancel: revert to original
  const handleCancel = () => {
    setRolePermissions((prev) => ({ ...prev, [selectedRole]: [...originalPerms] }));
    setDirty(false);
  };

  // Warn on browser close with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  // In-app navigation guard state
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  if (!isAdmin) {
    navigate("/");
    return null;
  }

  // Group permissions by category
  const categories = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const currentPerms = rolePermissions[selectedRole] || [];

  const togglePermission = (key: string) => {
    if (selectedRole === "admin") return; // Admin cannot be modified
    const updated = currentPerms.includes(key)
      ? currentPerms.filter((k) => k !== key)
      : [...currentPerms, key];
    setRolePermissions((prev) => ({ ...prev, [selectedRole]: updated }));
    setDirty(JSON.stringify(updated.sort()) !== JSON.stringify(originalPerms.sort()));
  };

  const toggleCategory = (category: string) => {
    if (selectedRole === "admin") return;
    const catKeys = categories[category].map((p) => p.key);
    const allChecked = catKeys.every((k) => currentPerms.includes(k));
    let updated: string[];
    if (allChecked) {
      updated = currentPerms.filter((k) => !catKeys.includes(k));
    } else {
      updated = [...new Set([...currentPerms, ...catKeys])];
    }
    setRolePermissions((prev) => ({ ...prev, [selectedRole]: updated }));
    setDirty(JSON.stringify(updated.sort()) !== JSON.stringify(originalPerms.sort()));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing permissions for this role
      await (supabase.from as any)("role_permissions").delete().eq("role", selectedRole);
      // Insert new ones
      if (currentPerms.length > 0) {
        const rows = currentPerms.map((key) => ({ role: selectedRole, permission_key: key }));
        const { error } = await (supabase.from as any)("role_permissions").insert(rows);
        if (error) throw error;
      }
      setOriginalPerms([...currentPerms]);
      setDirty(false);
      toast({ title: "Permissions updated successfully", description: `Updated permissions for ${ROLE_LABELS[selectedRole] || selectedRole}.` });
      addLog({ actionType: "Role Permissions Updated", userName, role: userRole || "unknown", entity: ROLE_LABELS[selectedRole] || selectedRole, details: `${currentPerms.length} permissions assigned` });
    } catch (err: any) {
      toast({ title: "Error saving permissions", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5" /> Roles & Permissions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage permission sets for each role</p>
          </div>
        
        </div>

        {/* Role Tabs */}
        <div className="flex gap-2 mb-6">
          {SYSTEM_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRole(r)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                selectedRole === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {ROLE_LABELS[r]}
              {r === "admin" && <Badge variant="outline" className="ml-2 text-[9px] h-4 px-1">Locked</Badge>}
            </button>
          ))}
        </div>

        {selectedRole === "admin" && (
          <div className="rounded-xl border border-border bg-info/5 p-4 mb-4">
            <p className="text-sm text-info font-medium">Admin role has full access to all permissions. This cannot be modified.</p>
          </div>
        )}

        {/* Permission Matrix */}
        <div className="space-y-4">
          {Object.entries(categories).map(([category, perms]) => {
            const allChecked = perms.every((p) => currentPerms.includes(p.key));
            const someChecked = perms.some((p) => currentPerms.includes(p.key));
            return (
              <div key={category} className="rounded-xl border border-border bg-card p-4 card-shadow">
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border">
                  <Checkbox
                    checked={allChecked}
                    // @ts-ignore
                    indeterminate={someChecked && !allChecked}
                    onCheckedChange={() => toggleCategory(category)}
                    disabled={selectedRole === "admin"}
                  />
                  <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                  <span className="text-xs text-muted-foreground">
                    {perms.filter((p) => currentPerms.includes(p.key)).length}/{perms.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {perms.map((p) => (
                    <label
                      key={p.key}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer transition-all duration-200",
                        currentPerms.includes(p.key) ? "bg-primary/5" : "hover:bg-muted/50",
                        selectedRole === "admin" && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <Checkbox
                        checked={currentPerms.includes(p.key)}
                        onCheckedChange={() => togglePermission(p.key)}
                        disabled={selectedRole === "admin"}
                      />
                      <span className="text-foreground">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Always-visible sticky bottom action bar */}
        {selectedRole !== "admin" && (
          <div className="sticky bottom-4 mt-6 z-10">
            <div className={cn(
              "rounded-xl border p-3 flex items-center justify-between shadow-lg backdrop-blur-sm transition-all duration-300",
              dirty
                ? "border-warning/30 bg-warning/5"
                : "border-border bg-card"
            )}>
              <p className="text-sm font-medium text-muted-foreground">
                {dirty ? "You have unsaved permission changes" : "Permission settings for this role"}
              </p>
              <div className="flex gap-2">
                {dirty && (
                  <Button variant="outline" onClick={handleCancel} size="sm" className="gap-1.5">
                    <Undo2 className="h-3.5 w-3.5" /> Cancel Changes
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  size="sm"
                  className={cn(
                    "gap-1.5 transition-all duration-200",
                    dirty && "animate-pulse-once ring-2 ring-primary/30"
                  )}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Update Permissions
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation blocker dialog */}
        <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved permission changes. Do you want to leave without saving?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowLeaveDialog(false); setPendingNavigation(null); }}>Stay</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setShowLeaveDialog(false); if (pendingNavigation) navigate(pendingNavigation); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
