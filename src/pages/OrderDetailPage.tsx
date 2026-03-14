import { useState, useEffect } from "react";
import { createAssignmentNotifications } from "@/hooks/useNotifications";
import { useActivityLog } from "@/hooks/useActivityLog";
import OrderActivityTimeline from "@/components/OrderActivityTimeline";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Phone, MapPin, Package, Calendar, RefreshCw, ShoppingCart, Zap, Truck, Edit2, Trash2, CheckCircle, Clock, MessageSquare, User, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import EditOrderDialog from "@/components/EditOrderDialog";
import DeleteOrderDialog from "@/components/DeleteOrderDialog";
import CompleteFollowupDialog from "@/components/CompleteFollowupDialog";
import EditFollowupDialog from "@/components/EditFollowupDialog";
import EditUpsellDialog from "@/components/EditUpsellDialog";
import EditRepeatOrderDialog from "@/components/EditRepeatOrderDialog";
import { useToast } from "@/hooks/use-toast";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useDeliveryMethods } from "@/hooks/useDeliveryMethods";
import { FollowupHistoryEntry } from "@/types/data";
import { supabase } from "@/integrations/supabase/client";


const STEP_COLORS = [
  "bg-step-1 text-primary-foreground",
  "bg-step-2 text-primary-foreground",
  "bg-step-3 text-primary-foreground",
  "bg-step-4 text-primary-foreground",
  "bg-step-5 text-primary-foreground",
];

const healthColors: Record<string, string> = {
  new: "bg-info/10 text-info",
  good: "bg-success/10 text-success",
  "at-risk": "bg-warning/10 text-warning",
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const { hasPermission } = usePermissions();
  const canEditOrder = isAdmin || hasPermission("orders.edit");
  const canDeleteOrder = isAdmin || hasPermission("orders.delete");
  const { activeOrders, orders, softDelete, updateOrder, completeFollowup, editFollowup, getOrderHistory, getUpsellsForFollowup, getRepeatOrdersForFollowup, refreshOrders } = useOrderStore();
  const { toast } = useToast();
  const { addLog } = useAuditLog();
  const { logActivity } = useActivityLog();
  const { user, profile, role } = useAuth();
  const { members } = useTeamMembers();
  const { methods: deliveryMethods } = useDeliveryMethods({ activeOnly: false });
  const order = orders.find((o) => o.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [editFollowupOpen, setEditFollowupOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FollowupHistoryEntry | null>(null);
  const [editUpsellOpen, setEditUpsellOpen] = useState(false);
  const [editUpsellFollowupId, setEditUpsellFollowupId] = useState("");
  const [editRepeatOpen, setEditRepeatOpen] = useState(false);
  const [editRepeatFollowupId, setEditRepeatFollowupId] = useState("");
  const userName = profile?.full_name || "Admin User";


  const allExecutives = members.map((m) => ({ id: m.userId, name: m.name }));

  const getDeliveryName = (id: string): string => {
    return deliveryMethods.find((dm) => dm.id === id)?.name || id;
  };

  const handleAssignChange = async (execId: string) => {
    if (!order) return;
    const isUnassign = execId === "__unassign__";
    const exec = allExecutives.find((e) => e.id === execId);
    const oldName = order.assignedToName || "Unassigned";
    const newName = isUnassign ? "Unassigned" : (exec?.name || "");

    const { error } = await supabase
      .from("orders")
      .update({ assigned_to: isUnassign ? null : execId, assigned_to_name: isUnassign ? "" : newName })
      .eq("id", order.id);

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await refreshOrders();
    toast({ title: isUnassign ? "Assignment Removed" : "Assignment Updated" });
    addLog({ actionType: isUnassign ? "Assignment Removed" : "Assignment Transferred", userName, role: role || "unknown", entity: `Order #${order.invoiceId || order.id}`, details: `${oldName} → ${newName}` });
    await logActivity({ orderId: order.id, actionType: isUnassign ? "Assignment Removed" : "Order Assigned", actionDescription: `${oldName} → ${newName}` });

    // Create notifications for assignment
    if (!isUnassign && exec && user && profile?.project_id) {
      await createAssignmentNotifications({
        orderId: order.id,
        orderName: order.customerName,
        assignedToId: execId,
        assignedToName: exec.name,
        assignedById: user.id,
        projectId: profile.project_id,
      });
    }
  };

  if (!order) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground mb-4">Order not found</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  const childOrders = activeOrders.filter((o) => o.parentOrderId === order.id);
  const parentOrder = order.parentOrderId ? orders.find((o) => o.id === order.parentOrderId) : null;
  const history = getOrderHistory(order.id);
  const currentStatus = order.currentStatus || "pending";
  const canComplete = currentStatus === "pending" && !order.isDeleted;

  // Collect all upsells and repeats across all followups for this order
  const allUpsells = history.flatMap((h) => getUpsellsForFollowup(h.id));
  const allRepeats = history.flatMap((h) => getRepeatOrdersForFollowup(h.id));

  const handleEditFollowup = (entry: FollowupHistoryEntry) => {
    setEditingEntry(entry);
    setEditFollowupOpen(true);
  };

  const handleEditUpsells = (followupId: string) => {
    setEditUpsellFollowupId(followupId);
    setEditUpsellOpen(true);
  };

  const handleEditRepeats = (followupId: string) => {
    setEditRepeatFollowupId(followupId);
    setEditRepeatOpen(true);
  };

  return (
    <AppLayout>
      <div className="max-w-5xl animate-fade-in">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {canComplete && (
              <Button size="sm" className="gap-1.5" onClick={() => setFollowupOpen(true)}>
                <CheckCircle className="h-3.5 w-3.5" /> Complete Step {order.followupStep}
              </Button>
            )}
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
                  <Edit2 className="h-3.5 w-3.5" /> Edit Order
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Order Summary Header */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{order.customerName}</h1>
                <span className="text-xs text-muted-foreground">#{order.generatedOrderId || order.invoiceId || order.id}</span>
                {order.isRepeat && <Badge variant="outline" className="text-[10px] h-5 border-warning/40 text-warning bg-warning/5">REPEAT</Badge>}
                {order.isUpsell && <Badge variant="outline" className="text-[10px] h-5 border-info/40 text-info bg-info/5">UPSELL</Badge>}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {order.mobile}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.address}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium capitalize", healthColors[order.health])}>{order.health}</span>
              <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium capitalize", statusColors[currentStatus])}>{currentStatus}</span>
            </div>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 mb-4">
            <TabsTrigger value="info">Order Info</TabsTrigger>
            <TabsTrigger value="followups">
              Followup History
              {history.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{history.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="upsells">
              Upsells
              {allUpsells.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{allUpsells.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="repeats">
              Repeat Orders
              {allRepeats.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{allRepeats.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Order Info Tab */}
          <TabsContent value="info">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Order Details</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><p className="text-xs text-muted-foreground">Product</p><p className="text-sm font-medium text-foreground flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {order.productTitle}</p></div>
                    <div><p className="text-xs text-muted-foreground">Price</p><p className="text-sm font-bold text-foreground">৳{order.price}</p></div>
                    <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm font-medium text-foreground">{order.orderSource}</p></div>
                    <div><p className="text-xs text-muted-foreground">Assigned To</p><p className="text-sm font-medium text-foreground">{order.assignedToName || "Unassigned"}</p></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border mt-4">
                    <div><p className="text-xs text-muted-foreground">Order Date</p><p className="text-sm font-medium text-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {order.orderDate}</p></div>
                    <div><p className="text-xs text-muted-foreground">Delivery Date</p><p className="text-sm font-medium text-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {order.deliveryDate}</p></div>
                    <div><p className="text-xs text-muted-foreground">Delivery Method</p><p className="text-sm font-medium text-foreground flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {getDeliveryName(order.deliveryMethod)}</p></div>
                  </div>
                  {order.itemDescription && (
                    <div className="pt-4 border-t border-border mt-4">
                      <p className="text-xs text-muted-foreground">Item Description</p>
                      <p className="text-sm text-foreground">{order.itemDescription}</p>
                    </div>
                  )}
                </div>

                {/* Followup Progress */}
                <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-foreground">Followup Progress</h2>
                    <span className="text-xs text-muted-foreground">Step {order.followupStep}/5</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((step) => {
                      const isCompleted = step < order.followupStep || (step === order.followupStep && currentStatus === "completed");
                      const isCurrent = step === order.followupStep && currentStatus === "pending";
                      return (
                        <div key={step} className="flex-1 flex flex-col items-center gap-1.5">
                          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-200", isCompleted ? "bg-success text-success-foreground" : isCurrent ? STEP_COLORS[step - 1] : "bg-muted text-muted-foreground")}>
                            {isCompleted ? <CheckCircle className="h-4 w-4" /> : step}
                          </div>
                          <p className="text-[10px] text-muted-foreground">Step {step}</p>
                        </div>
                      );
                    })}
                  </div>
                  {order.followupDate && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {currentStatus === "pending" ? "Current followup:" : "Next followup:"} {order.followupDate}
                    </p>
                  )}
                </div>

                {order.note && (
                  <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                    <h2 className="text-sm font-semibold text-foreground mb-2">Order Note</h2>
                    <p className="text-sm text-muted-foreground">{order.note}</p>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Quick Info */}
                <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Quick Info</h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Current Step</p>
                      <p className="text-sm font-semibold text-foreground">Step {order.followupStep} - {["1st", "2nd", "3rd", "4th", "5th"][order.followupStep - 1]} Followup</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize", statusColors[currentStatus])}>{currentStatus}</span>
                    </div>
                    {order.followupDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">{currentStatus === "completed" ? "Next Followup Date" : "Current Followup Date"}</p>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {order.followupDate}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment */}
                <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                  <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Assignment</h2>
                  {order.assignedTo && order.assignedToName ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {order.assignedToName.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{order.assignedToName}</p>
                          <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-primary/20 text-primary">Assigned</Badge>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1.5 pt-2 border-t border-border">
                          <Select onValueChange={handleAssignChange}>
                            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Transfer to..." /></SelectTrigger>
                            <SelectContent>
                              {allExecutives.filter((e) => e.id !== order.assignedTo).map((e) => (
                                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-warning hover:text-warning" onClick={() => handleAssignChange("__unassign__")}>
                            <UserX className="h-3 w-3" /> Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Badge variant="outline" className="text-[10px] h-5 px-2 border-warning/40 text-warning bg-warning/5">Unassigned</Badge>
                      {isAdmin && (
                        <Select onValueChange={handleAssignChange}>
                          <SelectTrigger className="h-7 text-xs mt-2"><SelectValue placeholder="Assign to..." /></SelectTrigger>
                          <SelectContent>
                            {allExecutives.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>

                {/* Parent / Child links */}
                {parentOrder && (
                  <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                    <h2 className="text-sm font-semibold text-foreground mb-2">Parent Order</h2>
                    <div onClick={() => navigate(`/orders/${parentOrder.id}`)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-all duration-200">
                      <RefreshCw className="h-3.5 w-3.5 text-warning" />
                      <span className="text-xs font-medium text-foreground">#{parentOrder.invoiceId || parentOrder.id}</span>
                      <span className="text-xs text-muted-foreground">{parentOrder.customerName}</span>
                    </div>
                  </div>
                )}

                {childOrders.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                    <h2 className="text-sm font-semibold text-foreground mb-2">Child Orders ({childOrders.length})</h2>
                    {childOrders.map((child) => (
                      <div key={child.id} onClick={() => navigate(`/orders/${child.id}`)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-all duration-200">
                        <RefreshCw className="h-3.5 w-3.5 text-warning" />
                        <span className="text-xs font-medium text-foreground">#{child.invoiceId || child.id}</span>
                        <span className="text-xs text-muted-foreground">৳{child.price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Followup History Tab */}
          <TabsContent value="followups">
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h2 className="text-sm font-semibold text-foreground mb-4">Followup History</h2>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No followup history yet. Complete the first followup to start tracking.</p>
              ) : (
                <div className="space-y-0">
                  {history.map((entry, i) => {
                    const upsells = getUpsellsForFollowup(entry.id);
                    const repeats = getRepeatOrdersForFollowup(entry.id);
                    return (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                            <CheckCircle className="h-4 w-4" />
                          </div>
                          {i < history.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                        </div>
                        <div className="pb-5 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground">Step {entry.stepNumber} Completed</p>
                            <div className="flex items-center gap-1.5">
                              {entry.editedAt && <span className="text-[10px] text-muted-foreground italic">edited</span>}
                              <p className="text-[10px] text-muted-foreground">{entry.completedAt?.split("T")[0]}</p>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditFollowup(entry)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">By {entry.completedByName || "Unknown"}</p>
                          {entry.note && (
                            <div className="mt-2 rounded-lg bg-muted/50 p-2">
                              <p className="text-xs text-foreground flex items-center gap-1 mb-1"><MessageSquare className="h-3 w-3" /> Note</p>
                              <p className="text-xs text-muted-foreground">{entry.note}</p>
                            </div>
                          )}
                          {entry.problemsDiscussed && (
                            <div className="mt-1.5 rounded-lg bg-warning/5 p-2">
                              <p className="text-xs text-warning font-medium mb-0.5">Problems Discussed</p>
                              <p className="text-xs text-muted-foreground">{entry.problemsDiscussed}</p>
                            </div>
                          )}
                          {/* Upsells inline */}
                          {upsells.length > 0 && (
                            <div className="mt-1.5 rounded-lg bg-info/5 p-2">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-info font-medium flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Upsells ({upsells.length})</p>
                                {isAdmin && (
                                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-info" onClick={() => handleEditUpsells(entry.id)}>
                                    <Edit2 className="h-2.5 w-2.5 mr-0.5" /> Edit
                                  </Button>
                                )}
                              </div>
                              {upsells.map((u) => (
                                <div key={u.id} className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
                                  <span>{u.productName}</span>
                                  <span className="font-medium">৳{u.price}</span>
                                </div>
                              ))}
                              <div className="flex justify-end pt-1 border-t border-info/10 mt-1">
                                <span className="text-xs font-semibold text-info">Total: ৳{upsells.reduce((s, u) => s + u.price, 0)}</span>
                              </div>
                            </div>
                          )}
                          {/* Repeats inline */}
                          {repeats.length > 0 && (
                            <div className="mt-1.5 rounded-lg bg-warning/5 p-2">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-warning font-medium flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Repeat Orders ({repeats.length})</p>
                                {isAdmin && (
                                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-warning" onClick={() => handleEditRepeats(entry.id)}>
                                    <Edit2 className="h-2.5 w-2.5 mr-0.5" /> Edit
                                  </Button>
                                )}
                              </div>
                              {repeats.map((r) => (
                                <div key={r.id} className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
                                  <span className="cursor-pointer hover:text-foreground transition-colors duration-200" onClick={() => r.childOrderId && navigate(`/orders/${r.childOrderId}`)}>
                                    {r.productName}
                                  </span>
                                  <span className="font-medium">৳{r.price}</span>
                                </div>
                              ))}
                              <div className="flex justify-end pt-1 border-t border-warning/10 mt-1">
                                <span className="text-xs font-semibold text-warning">Total: ৳{repeats.reduce((s, r) => s + r.price, 0)}</span>
                              </div>
                            </div>
                          )}
                          {/* No upsells - show add button for admin */}
                          {upsells.length === 0 && isAdmin && (
                            <Button variant="ghost" size="sm" className="h-6 mt-1.5 text-[10px] text-info gap-1" onClick={() => handleEditUpsells(entry.id)}>
                              <ShoppingCart className="h-3 w-3" /> Add Upsell
                            </Button>
                          )}
                          {entry.nextFollowupDate && (
                            <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-1.5">
                              <Clock className="h-3 w-3" /> Next followup: {entry.nextFollowupDate}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Upsells Tab */}
          <TabsContent value="upsells">
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">All Upsell Records</h2>
                <p className="text-xs text-muted-foreground">
                  Total: ৳{allUpsells.reduce((s, u) => s + u.price, 0)}
                </p>
              </div>
              {allUpsells.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No upsell records for this order.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((entry) => {
                    const upsells = getUpsellsForFollowup(entry.id);
                    if (upsells.length === 0) return null;
                    return (
                      <div key={entry.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-foreground">Step {entry.stepNumber} • {entry.completedAt?.split("T")[0]}</p>
                          {isAdmin && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => handleEditUpsells(entry.id)}>
                              <Edit2 className="h-3 w-3" /> Edit
                            </Button>
                          )}
                        </div>
                        {upsells.map((u) => (
                          <div key={u.id} className="flex items-center justify-between text-sm py-1.5 border-t border-border/50">
                            <div>
                              <p className="font-medium text-foreground">{u.productName}</p>
                              {u.note && <p className="text-xs text-muted-foreground">{u.note}</p>}
                            </div>
                            <p className="font-semibold text-foreground">৳{u.price}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Repeat Orders Tab */}
          <TabsContent value="repeats">
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">All Repeat Order Records</h2>
                <p className="text-xs text-muted-foreground">
                  Total: ৳{allRepeats.reduce((s, r) => s + r.price, 0)}
                </p>
              </div>
              {allRepeats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No repeat order records for this order.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((entry) => {
                    const repeats = getRepeatOrdersForFollowup(entry.id);
                    if (repeats.length === 0) return null;
                    return (
                      <div key={entry.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-foreground">Step {entry.stepNumber} • {entry.completedAt?.split("T")[0]}</p>
                          {isAdmin && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => handleEditRepeats(entry.id)}>
                              <Edit2 className="h-3 w-3" /> Edit
                            </Button>
                          )}
                        </div>
                        {repeats.map((r) => (
                          <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-t border-border/50">
                            <div>
                              <p className="font-medium text-foreground cursor-pointer hover:text-primary transition-colors duration-200" onClick={() => r.childOrderId && navigate(`/orders/${r.childOrderId}`)}>
                                {r.productName}
                              </p>
                              {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                              {r.childOrderId && <p className="text-[10px] text-muted-foreground/60">Child Order: {r.childOrderId.slice(0, 8)}...</p>}
                            </div>
                            <p className="font-semibold text-foreground">৳{r.price}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <OrderActivityTimeline orderId={order.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {isAdmin && (
        <>
          <EditOrderDialog order={order} open={editOpen} onOpenChange={setEditOpen} onSave={async (updated) => { await updateOrder(updated); setEditOpen(false); }} />
          <DeleteOrderDialog order={order} open={deleteOpen} onOpenChange={setDeleteOpen} childCount={childOrders.length} onConfirm={async () => { await softDelete(order.id); toast({ title: "Order Deleted" }); navigate("/orders"); }} />
        </>
      )}

      <CompleteFollowupDialog order={order} open={followupOpen} onOpenChange={setFollowupOpen} onComplete={completeFollowup} />

      {isAdmin && (
        <>
          <EditFollowupDialog entry={editingEntry} open={editFollowupOpen} onOpenChange={setEditFollowupOpen} onSave={editFollowup} />
          <EditUpsellDialog followupId={editUpsellFollowupId} upsells={editUpsellFollowupId ? getUpsellsForFollowup(editUpsellFollowupId) : []} open={editUpsellOpen} onOpenChange={setEditUpsellOpen} />
          <EditRepeatOrderDialog repeats={editRepeatFollowupId ? getRepeatOrdersForFollowup(editRepeatFollowupId) : []} open={editRepeatOpen} onOpenChange={setEditRepeatOpen} />
        </>
      )}
    </AppLayout>
  );
}
