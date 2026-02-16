import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { mockDeliveryPartners } from "@/data/mockData";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, MapPin, Package, Calendar, RefreshCw, ShoppingCart, Zap, Truck, Edit2, Trash2, CheckCircle, Clock, MessageSquare, User, UserPlus, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import EditOrderDialog from "@/components/EditOrderDialog";
import DeleteOrderDialog from "@/components/DeleteOrderDialog";
import CompleteFollowupDialog from "@/components/CompleteFollowupDialog";
import EditFollowupDialog from "@/components/EditFollowupDialog";
import { useToast } from "@/hooks/use-toast";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { FollowupHistoryEntry } from "@/types/data";
import { supabase } from "@/integrations/supabase/client";
import { mockSalesExecutives } from "@/data/mockData";

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

function getDeliveryName(id: string): string {
  return mockDeliveryPartners.find((dp) => dp.id === id)?.name || id;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const { activeOrders, softDelete, updateOrder, completeFollowup, editFollowup, getOrderHistory, getUpsellsForFollowup, getRepeatOrdersForFollowup, refreshOrders } = useOrderStore();
  const { toast } = useToast();
  const { addLog } = useAuditLog();
  const { profile, role } = useAuth();
  const { members } = useTeamMembers();
  const order = activeOrders.find((o) => o.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [editFollowupOpen, setEditFollowupOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FollowupHistoryEntry | null>(null);
  const userName = profile?.full_name || "Admin User";

  // Combine DB members with mock for dropdown
  const allExecutives = [
    ...members.map((m) => ({ id: m.userId, name: m.name })),
    ...mockSalesExecutives.filter((se) => !members.some((m) => m.userId === se.id)).map((se) => ({ id: se.id, name: se.name })),
  ];

  const handleAssignChange = async (execId: string) => {
    if (!order) return;
    const isUnassign = execId === "__unassign__";
    const exec = allExecutives.find((e) => e.id === execId);
    const oldName = order.assignedToName || "Unassigned";
    const newName = isUnassign ? "Unassigned" : (exec?.name || "");

    const { error } = await supabase
      .from("orders")
      .update({
        assigned_to: isUnassign ? null : execId,
        assigned_to_name: isUnassign ? "" : newName,
      })
      .eq("id", order.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await refreshOrders();
    toast({ title: isUnassign ? "Assignment Removed" : "Assignment Updated", description: isUnassign ? "Order is now unassigned" : `Assigned to ${newName}` });
    addLog({
      actionType: isUnassign ? "Assignment Removed" : "Assignment Transferred",
      userName,
      role: role || "unknown",
      entity: `Order #${order.invoiceId || order.id}`,
      details: `${oldName} → ${newName}`,
    });
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
  const parentOrder = order.parentOrderId ? activeOrders.find((o) => o.id === order.parentOrderId) : null;
  const history = getOrderHistory(order.id);
  const currentStatus = order.currentStatus || "pending";
  const canComplete = currentStatus === "pending";

  const handleEditFollowup = (entry: FollowupHistoryEntry) => {
    setEditingEntry(entry);
    setEditFollowupOpen(true);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl animate-fade-in">
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
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Order Info Card */}
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold text-foreground">{order.customerName}</h1>
                    <span className="text-xs text-muted-foreground">#{order.invoiceId || order.id}</span>
                    {order.isRepeat && <span className="text-[10px] font-medium rounded px-1.5 py-0.5 bg-warning/10 text-warning">REPEAT</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {order.mobile}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.address}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium capitalize", healthColors[order.health])}>
                    {order.health}
                  </span>
                  <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium capitalize", statusColors[currentStatus])}>
                    {currentStatus}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
                <div><p className="text-xs text-muted-foreground">Product</p><p className="text-sm font-medium text-foreground flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {order.productTitle}</p></div>
                <div><p className="text-xs text-muted-foreground">Price</p><p className="text-sm font-bold text-foreground">৳{order.price}</p></div>
                <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm font-medium text-foreground">{order.orderSource}</p></div>
                <div><p className="text-xs text-muted-foreground">Assigned To</p><p className="text-sm font-medium text-foreground">{order.assignedToName}</p></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border mt-4">
                <div><p className="text-xs text-muted-foreground">Order Date</p><p className="text-sm font-medium text-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {order.orderDate}</p></div>
                <div><p className="text-xs text-muted-foreground">Delivery Date</p><p className="text-sm font-medium text-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {order.deliveryDate}</p></div>
                <div><p className="text-xs text-muted-foreground">Delivery Method</p><p className="text-sm font-medium text-foreground flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {getDeliveryName(order.deliveryMethod)}</p></div>
              </div>
            </div>

            {/* Followup Progress Card */}
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Followup Progress</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Step {order.followupStep}/5</span>
                  <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", statusColors[currentStatus])}>
                    {currentStatus}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((step) => {
                  const isCompleted = step < order.followupStep || (step === order.followupStep && currentStatus === "completed");
                  const isCurrent = step === order.followupStep && currentStatus === "pending";
                  return (
                    <div key={step} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-fast",
                        isCompleted ? "bg-success text-success-foreground" :
                        isCurrent ? STEP_COLORS[step - 1] :
                        "bg-muted text-muted-foreground"
                      )}>
                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : step}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Step {step}</p>
                    </div>
                  );
                })}
              </div>
              {order.followupDate && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {currentStatus === "pending" ? "Current followup date:" : "Next followup date:"} {order.followupDate}
                </p>
              )}
            </div>

            {/* Followup History */}
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
                        <div className="pb-4 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground">Step {entry.stepNumber} Completed</p>
                            <div className="flex items-center gap-1.5">
                              {entry.editedAt && <span className="text-[10px] text-muted-foreground italic">edited</span>}
                              <p className="text-[10px] text-muted-foreground">{entry.completedAt?.split("T")[0]}</p>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleEditFollowup(entry)}>
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
                          {/* Upsell Records */}
                          {upsells.length > 0 && (
                            <div className="mt-1.5 rounded-lg bg-info/5 p-2">
                              <p className="text-xs text-info font-medium mb-1 flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Upsells ({upsells.length})</p>
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
                          {/* Repeat Order Records */}
                          {repeats.length > 0 && (
                            <div className="mt-1.5 rounded-lg bg-warning/5 p-2">
                              <p className="text-xs text-warning font-medium mb-1 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Repeat Orders ({repeats.length})</p>
                              {repeats.map((r) => (
                                <div key={r.id} className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
                                  <span className="cursor-pointer hover:text-foreground" onClick={() => r.childOrderId && navigate(`/orders/${r.childOrderId}`)}>
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

            {/* Order Note */}
            {order.note && (
              <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                <h2 className="text-sm font-semibold text-foreground mb-2">Order Note</h2>
                <p className="text-sm text-muted-foreground">{order.note}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h2 className="text-sm font-semibold text-foreground mb-4">Quick Info</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Current Step</p>
                  <p className="text-sm font-semibold text-foreground">Step {order.followupStep} - {["1st", "2nd", "3rd", "4th", "5th"][order.followupStep - 1]} Followup</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize", statusColors[currentStatus])}>
                    {currentStatus}
                  </span>
                </div>
                {order.followupStep < 5 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Next Step</p>
                    <p className="text-sm text-foreground">Step {order.followupStep + 1} - {["1st", "2nd", "3rd", "4th", "5th"][order.followupStep]} Followup</p>
                  </div>
                )}
                {order.followupDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">{currentStatus === "completed" ? "Next Followup Date" : "Current Followup Date"}</p>
                    <p className="text-sm font-medium text-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {order.followupDate}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Assignment Card */}
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Assignment
              </h2>
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
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Transfer to..." />
                        </SelectTrigger>
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
                      <SelectTrigger className="h-7 text-xs mt-2">
                        <SelectValue placeholder="Assign to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allExecutives.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h2 className="text-sm font-semibold text-foreground mb-4">Activity Timeline</h2>
              <div className="space-y-0">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div className="w-px flex-1 bg-border my-1" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-foreground">Order Created</p>
                    <p className="text-xs text-muted-foreground">{order.productTitle} - ৳{order.price}</p>
                    <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3" /> {order.createdAt}</p>
                  </div>
                </div>

                {order.isRepeat && parentOrder && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                        <RefreshCw className="h-4 w-4" />
                      </div>
                      <div className="w-px flex-1 bg-border my-1" />
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-foreground">Repeat Order</p>
                      <p className="text-xs text-muted-foreground">Linked to parent order #{parentOrder.invoiceId || parentOrder.id}</p>
                    </div>
                  </div>
                )}

                {history.map((entry) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="w-px flex-1 bg-border my-1" />
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-foreground">Step {entry.stepNumber} Completed</p>
                      <p className="text-xs text-muted-foreground">{entry.note || "Followup completed"}</p>
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3" /> {entry.completedAt?.split("T")[0]}</p>
                    </div>
                  </div>
                ))}

                {childOrders.length > 0 && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                        <Zap className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-foreground">Upsell / Repeat</p>
                      <p className="text-xs text-muted-foreground">{childOrders.length} repeat order(s) created</p>
                    </div>
                  </div>
                )}
              </div>

              {childOrders.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h3 className="text-xs font-semibold text-foreground mb-2">Repeat Orders ({childOrders.length})</h3>
                  {childOrders.map((child) => (
                    <div key={child.id} onClick={() => navigate(`/orders/${child.id}`)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-fast">
                      <RefreshCw className="h-3.5 w-3.5 text-warning" />
                      <span className="text-xs font-medium text-foreground">#{child.invoiceId || child.id}</span>
                      <span className="text-xs text-muted-foreground">৳{child.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <>
          <EditOrderDialog order={order} open={editOpen} onOpenChange={setEditOpen} onSave={async (updated) => { await updateOrder(updated); setEditOpen(false); }} />
          <DeleteOrderDialog order={order} open={deleteOpen} onOpenChange={setDeleteOpen} childCount={childOrders.length} onConfirm={async () => { await softDelete(order.id); toast({ title: "Order Deleted", description: `Order #${order.id} moved to deleted orders.` }); navigate("/orders"); }} />
        </>
      )}

      <CompleteFollowupDialog
        order={order}
        open={followupOpen}
        onOpenChange={setFollowupOpen}
        onComplete={completeFollowup}
      />

      {isAdmin && (
        <EditFollowupDialog
          entry={editingEntry}
          open={editFollowupOpen}
          onOpenChange={setEditFollowupOpen}
          onSave={editFollowup}
        />
      )}
    </AppLayout>
  );
}
