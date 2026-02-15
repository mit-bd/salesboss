import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { mockDeliveryPartners } from "@/data/mockData";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, MapPin, Package, Calendar, RefreshCw, ShoppingCart, Zap, Truck, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";
import EditOrderDialog from "@/components/EditOrderDialog";
import DeleteOrderDialog from "@/components/DeleteOrderDialog";
import { useToast } from "@/hooks/use-toast";

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

function getDeliveryName(id: string): string {
  return mockDeliveryPartners.find((dp) => dp.id === id)?.name || id;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const { activeOrders, softDelete, updateOrder } = useOrderStore();
  const { toast } = useToast();
  const order = activeOrders.find((o) => o.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const timeline = [
    {
      icon: <ShoppingCart className="h-4 w-4" />,
      title: "Order Created",
      description: `${order.productTitle} - ৳${order.price}`,
      date: order.createdAt,
      color: "bg-primary/10 text-primary",
    },
    ...(order.isRepeat && parentOrder
      ? [{ icon: <RefreshCw className="h-4 w-4" />, title: "Repeat Order", description: `Linked to parent order #${parentOrder.id}`, date: order.createdAt, color: "bg-warning/10 text-warning" }]
      : []),
    ...Array.from({ length: Math.min(order.followupStep, 5) }, (_, i) => ({
      icon: <Phone className="h-4 w-4" />,
      title: `Step ${i + 1} Followup${i + 1 < order.followupStep ? " - Completed" : " - Pending"}`,
      description: i + 1 < order.followupStep ? "Followup completed successfully" : "Scheduled followup",
      date: i + 1 === order.followupStep ? order.followupDate : order.createdAt,
      color: i + 1 < order.followupStep ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
    })),
    ...(childOrders.length > 0
      ? [{ icon: <Zap className="h-4 w-4" />, title: "Upsell / Repeat", description: `${childOrders.length} repeat order(s) created`, date: childOrders[0].createdAt, color: "bg-info/10 text-info" }]
      : []),
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl animate-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold text-foreground">{order.customerName}</h1>
                    <span className="text-xs text-muted-foreground">#{order.id}</span>
                    {order.isRepeat && <span className="text-[10px] font-medium rounded px-1.5 py-0.5 bg-warning/10 text-warning">REPEAT</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {order.mobile}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.address}</span>
                  </div>
                </div>
                <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium capitalize", healthColors[order.health])}>
                  {order.health}
                </span>
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

            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h2 className="text-sm font-semibold text-foreground mb-4">Followup Progress</h2>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-fast", step < order.followupStep ? "bg-success text-success-foreground" : step === order.followupStep ? STEP_COLORS[step - 1] : "bg-muted text-muted-foreground")}>{step}</div>
                    <p className="text-[10px] text-muted-foreground">Step {step}</p>
                  </div>
                ))}
              </div>
            </div>

            {order.note && (
              <div className="rounded-xl border border-border bg-card p-5 card-shadow">
                <h2 className="text-sm font-semibold text-foreground mb-2">Order Note</h2>
                <p className="text-sm text-muted-foreground">{order.note}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 card-shadow">
            <h2 className="text-sm font-semibold text-foreground mb-4">Activity Timeline</h2>
            <div className="space-y-0">
              {timeline.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", event.color)}>{event.icon}</div>
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                    <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3" /> {event.date}</p>
                  </div>
                </div>
              ))}
            </div>
            {childOrders.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-xs font-semibold text-foreground mb-2">Repeat Orders ({childOrders.length})</h3>
                {childOrders.map((child) => (
                  <div key={child.id} onClick={() => navigate(`/orders/${child.id}`)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-fast">
                    <RefreshCw className="h-3.5 w-3.5 text-warning" />
                    <span className="text-xs font-medium text-foreground">#{child.id}</span>
                    <span className="text-xs text-muted-foreground">৳{child.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <>
          <EditOrderDialog order={order} open={editOpen} onOpenChange={setEditOpen} onSave={(updated) => { updateOrder(updated); setEditOpen(false); }} />
          <DeleteOrderDialog order={order} open={deleteOpen} onOpenChange={setDeleteOpen} childCount={childOrders.length} onConfirm={() => { softDelete(order.id); toast({ title: "Order Deleted", description: `Order #${order.id} moved to deleted orders.` }); navigate("/orders"); }} />
        </>
      )}
    </AppLayout>
  );
}
