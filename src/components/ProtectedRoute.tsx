import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { useOwnerProject } from "@/contexts/OwnerProjectContext";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: string;
  ownerOnly?: boolean;
}

export default function ProtectedRoute({ children, allowedRoles, requiredPermission, ownerOnly }: ProtectedRouteProps) {
  const { session, role, loading, roleChecked, requestStatus, profile } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();
  const { isInAdminMode } = useOwnerProject();
  const [suspended, setSuspended] = useState<boolean | null>(null);

  // Check if user's project is suspended
  useEffect(() => {
    if (!profile?.project_id || role === "owner") {
      setSuspended(false);
      return;
    }

    supabase
      .from("projects")
      .select("subscription_status, expiry_date")
      .eq("id", profile.project_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setSuspended(false); return; }
        if (data.subscription_status === "suspended") {
          setSuspended(true);
          return;
        }
        // Check if past grace period (expiry + 3 days)
        if (data.expiry_date) {
          const expiry = new Date(data.expiry_date);
          const graceEnd = new Date(expiry);
          graceEnd.setDate(graceEnd.getDate() + 3);
          if (new Date() > graceEnd) {
            setSuspended(true);
            return;
          }
        }
        setSuspended(false);
      });
  }, [profile?.project_id, role]);

  // Wait for auth to finish loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Wait for role to be checked
  if (!roleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Owner routes: handle immediately, no permission checks needed
  if (ownerOnly) {
    if (role === "owner") return <>{children}</>;
    return <Navigate to="/" replace />;
  }

  // Owner in admin mode can access any project route
  if (role === "owner" && isInAdminMode) {
    return <>{children}</>;
  }

  // Owner accessing non-owner routes without admin mode → redirect to owner dashboard
  if (role === "owner" && !isInAdminMode) {
    return <Navigate to="/owner" replace />;
  }

  // No role assigned — check request status
  if (role === null) {
    if (requestStatus === "pending" || requestStatus === "rejected") {
      return <Navigate to="/pending-approval" replace />;
    }
    return <Navigate to="/pending-approval" replace />;
  }

  // Check suspension status
  if (suspended === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (suspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Account Suspended</h1>
          <p className="text-muted-foreground">
            Your account has been suspended due to an expired subscription. Please contact the administrator to reactivate your account.
          </p>
        </div>
      </div>
    );
  }

  // Wait for permissions only for non-owner users
  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
