import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, CheckCircle, XCircle, Pencil, Trash2 } from "lucide-react";
import OwnerLayout from "@/components/owner/OwnerLayout";

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
  const { toast } = useToast();
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit dialog state
  const [editRequest, setEditRequest] = useState<ProjectRequest | null>(null);
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase.functions.invoke("manage-team", { body: { action: "list_requests" } });
    if (data?.requests) setRequests(data.requests);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    const { data, error } = await supabase.functions.invoke("manage-team", { body: { action: "approve_request", requestId } });
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
    const { data, error } = await supabase.functions.invoke("manage-team", { body: { action: "reject_request", requestId } });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Request rejected" });
      fetchRequests();
    }
    setActionLoading(null);
  };

  const handleDelete = async (requestId: string) => {
    setActionLoading(requestId);
    const { data, error } = await supabase.functions.invoke("manage-team", { body: { action: "delete_request", requestId } });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Request deleted" });
      fetchRequests();
    }
    setActionLoading(null);
  };

  const openEdit = (req: ProjectRequest) => {
    setEditRequest(req);
    setEditBusinessName(req.business_name);
    setEditOwnerName(req.owner_name);
    setEditEmail(req.email);
    setEditPhone(req.phone);
  };

  const handleEditSave = async () => {
    if (!editRequest) return;
    setEditLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: {
        action: "edit_request",
        requestId: editRequest.id,
        businessName: editBusinessName,
        ownerName: editOwnerName,
        email: editEmail,
        phone: editPhone,
      },
    });
    setEditLoading(false);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Request updated" });
      setEditRequest(null);
      fetchRequests();
    }
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge variant="default" className="bg-green-600">Approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <OwnerLayout title="Registration Requests" subtitle="Review and manage business registration requests" pendingCount={pendingCount}>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : requests.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No registration requests yet.</p>
      ) : (
        <div className="space-y-3">
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
                    <p className="text-xs text-muted-foreground">Submitted: {new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 flex-wrap">
                    {req.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => handleApprove(req.id)} disabled={actionLoading === req.id}>
                          {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(req.id)} disabled={actionLoading === req.id}>
                          <XCircle className="h-4 w-4 mr-1" />Reject
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(req)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Request</AlertDialogTitle>
                          <AlertDialogDescription>Permanently delete the request from "{req.business_name}"? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(req.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Request Dialog */}
      <Dialog open={!!editRequest} onOpenChange={(open) => !open && setEditRequest(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Registration Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Business Name</Label><Input value={editBusinessName} onChange={(e) => setEditBusinessName(e.target.value)} /></div>
            <div><Label>Owner Name</Label><Input value={editOwnerName} onChange={(e) => setEditOwnerName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRequest(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OwnerLayout>
  );
}
