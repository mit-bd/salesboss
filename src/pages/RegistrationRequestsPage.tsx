import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, LogOut } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Link } from "react-router-dom";

interface ProjectRequest {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
}

export default function RegistrationRequestsPage() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase.functions.invoke("manage-team", {
      body: { action: "list_requests" },
    });
    if (data?.requests) setRequests(data.requests);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "approve_request", requestId },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Request approved", description: "Project created and user granted Admin access." });
      fetchRequests();
    }
    setActionLoading(null);
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "reject_request", requestId },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Request rejected" });
      fetchRequests();
    }
    setActionLoading(null);
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge variant="default" className="bg-green-600">Approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Registration Requests</h1>
            <p className="text-sm text-muted-foreground">Review and manage business registration requests</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Navigation */}
        <div className="flex gap-3">
          <Link to="/owner">
            <Button variant="outline" size="sm">Dashboard</Button>
          </Link>
          <Link to="/owner/requests">
            <Button variant="default" size="sm">Registration Requests</Button>
          </Link>
          <Link to="/owner/projects">
            <Button variant="outline" size="sm">Projects</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No registration requests yet.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{req.business_name}</p>
                        {statusBadge(req.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">Owner: {req.owner_name}</p>
                      <p className="text-sm text-muted-foreground">Email: {req.email}</p>
                      {req.phone && <p className="text-sm text-muted-foreground">Phone: {req.phone}</p>}
                      <p className="text-xs text-muted-foreground">
                        Submitted: {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {req.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(req.id)}
                          disabled={actionLoading === req.id}
                        >
                          {actionLoading === req.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(req.id)}
                          disabled={actionLoading === req.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
