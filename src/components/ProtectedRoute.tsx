import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: string;
  ownerOnly?: boolean;
}

export default function ProtectedRoute({ children, allowedRoles, requiredPermission, ownerOnly }: ProtectedRouteProps) {
  const { session, role, loading, roleChecked, requestStatus } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();

  // Wait for auth to finish loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!roleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // No role assigned — check request status
  if (role === null) {
    if (requestStatus === "pending" || requestStatus === "rejected") {
      return <Navigate to="/pending-approval" replace />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Owner accessing regular routes → redirect to owner dashboard
  if (role === "owner" && !ownerOnly) {
    console.log("[ProtectedRoute] Owner redirecting to /owner");
    return <Navigate to="/owner" replace />;
  }

  // Non-owner accessing owner routes → redirect to home
  if (role !== "owner" && ownerOnly) {
    return <Navigate to="/" replace />;
  }

  // Owner routes don't need permission checks
  if (role === "owner" && ownerOnly) {
    return <>{children}</>;
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
