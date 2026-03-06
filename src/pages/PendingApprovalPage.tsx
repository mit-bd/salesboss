import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PhoneForwarded, Clock, XCircle } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function PendingApprovalPage() {
  const { session, role, requestStatus, loading, signOut } = useAuth();

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (role) return <Navigate to="/" replace />;

  const isRejected = requestStatus === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            {isRejected ? (
              <XCircle className="h-6 w-6 text-destructive" />
            ) : (
              <Clock className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {isRejected ? "Registration Rejected" : "Awaiting Approval"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRejected
              ? "Your registration request was rejected. Please contact the system administrator for more information."
              : "Your registration request has been submitted. You will be able to access the system once the administrator approves your account."}
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={signOut}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
