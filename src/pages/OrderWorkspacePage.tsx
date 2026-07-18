import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ArrowRight, Phone, MapPin, User, Package, Truck, Calendar,
  Sparkles, RefreshCw, Edit2, ExternalLink, Printer, FileDown, Trash2,
  Repeat2, CheckCircle, ShieldAlert, TrendingUp, Wallet, MessageSquare,

} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrderWorkspace } from "@/hooks/useOrderWorkspace";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import { useCustomerTags } from "@/hooks/useCustomerTags";
import { useCustomerAIScore } from "@/hooks/useCustomerAIScore";
import { useCustomerTimeline } from "@/hooks/useCustomerTimeline";
import { useOrderTimeline } from "@/hooks/useOrderTimeline";
import { useOrderPosition } from "@/hooks/useOrderPosition";
import { useOrderActivityLogs } from "@/hooks/useOrderActivityLogs";
import { useImportRunInfo } from "@/hooks/useImportRunInfo";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useRole } from "@/contexts/RoleContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { useAuth } from "@/contexts/AuthContext";
import EditOrderDialog from "@/components/EditOrderDialog";
import CompleteFollowupDialog from "@/components/CompleteFollowupDialog";
import DeleteOrderDialog from "@/components/DeleteOrderDialog";

import WorkspaceHeaderSummary from "@/components/workspace/WorkspaceHeaderSummary";
import OrderPositionCard from "@/components/workspace/OrderPositionCard";
import RelatedOrdersPanel from "@/components/workspace/RelatedOrdersPanel";
import OrderNavigator from "@/components/workspace/OrderNavigator";
import ActivityDiffViewer from "@/components/workspace/ActivityDiffViewer";
import AIRecommendationCard from "@/components/workspace/AIRecommendationCard";

const BST_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka", year: "numeric", month: "short", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: true,
});
const fmtBST = (iso?: string | null) => (iso ? BST_FMT.format(new Date(iso)) : "—");

const TAG_STYLE: Record<string, string> = {
  "VIP": "bg-amber-500/15 text-amber-600 border-amber-500/30",
  "Repeat Buyer": "bg-info/10 text-info border-info/30",
  "High Value": "bg-success/10 text-success border-success/30",
  "Upsell Ready": "bg-primary/10 text-primary border-primary/30",
  "Dormant": "bg-warning/10 text-warning border-warning/30",
  "Lost Customer": "bg-destructive/10 text-destructive border-destructive/30",
  "High Followup Priority": "bg-purple-500/15 text-purple-600 border-purple-500/30",
  "High COD Value": "bg-teal-500/15 text-teal-600 border-teal-500/30",
  "Frequently Cancels": "bg-destructive/10 text-destructive border-destructive/30",
};

function Section({ title, icon: Icon, action, children }: { title: string; icon?: any; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />} {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value ?? "—"}</p>
    </div>
  );
}

function ScoreBar({ label, value, tone = "primary", why }: { label: string; value: number; tone?: "primary" | "success" | "warning" | "destructive" | "info"; why?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  const bar: Record<string, string> = {
    primary: "bg-primary", success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", info: "bg-info",
  };
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold text-foreground">{v}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", bar[tone])} style={{ width: `${v}%` }} />
      </div>
      {why && <p className="text-[11px] text-muted-foreground leading-snug">{why}</p>}
    </div>
  );
}

export default function OrderWorkspacePage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { order, customer, loading } = useOrderWorkspace(orderId);
  const { orders: customerOrders } = useCustomerOrders(customer?.id);
  const { tags } = useCustomerTags(customer?.id);
  const { data: aiScore, loading: aiLoading, error: aiError, refresh: refreshAI } = useCustomerAIScore(customer?.id);
  const { events: custTimeline, loading: custTimelineLoading } = useCustomerTimeline(customer?.id, customer?.mobile_number);
  const { events: orderTimeline, loading: orderTimelineLoading } = useOrderTimeline(orderId);
  const { logs: activityLogs, loading: activityLoading, hasMore: activityHasMore, loadMore: activityLoadMore } = useOrderActivityLogs(orderId);
  const pos = useOrderPosition(customer?.id, orderId);
  const { isAdmin } = useRole();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { orders: storeOrders, completeFollowup, softDelete } = useOrderStore();
  const [editOpen, setEditOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openOrder = (id: string) => navigate(`/orders/${id}/workspace`, { replace: true });

  const storeOrder = storeOrders.find((o) => o.id === orderId);
  const canEdit = isAdmin || hasPermission("orders.edit");
  const canDelete = isAdmin || hasPermission("orders.delete");
  const canComplete = storeOrder && (storeOrder.currentStatus || "pending") === "pending" && !storeOrder.isDeleted;


  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40" />
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

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

  return (
    <AppLayout>
      <div className="animate-fade-in p-4 max-w-[1600px]">
        {/* Sticky workspace summary */}
        <WorkspaceHeaderSummary
          position={pos.position}
          total={pos.total}
          isFirstOrder={pos.isFirstOrder}
          isOnlyOrder={pos.isOnlyOrder}
          isRepeatCustomer={pos.isRepeatCustomer}
          lifetimeValue={customer?.lifetime_value || 0}
          healthScore={aiScore?.scores?.health ?? null}
          aiScore={aiScore?.scores?.overall ?? null}
          lastFollowupAt={customer?.last_followup_at}
          currentExecutive={order.assigned_to_name || customer?.last_executive_name || null}
          prevOrderId={pos.prevOrderId}
          nextOrderId={pos.nextOrderId}
          onPrev={() => pos.prevOrderId && openOrder(pos.prevOrderId)}
          onNext={() => pos.nextOrderId && openOrder(pos.nextOrderId)}
        />

        {/* Top action bar */}
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {canComplete && (
              <Button size="sm" className="gap-1.5" onClick={() => setFollowupOpen(true)}>
                <CheckCircle className="h-3.5 w-3.5" /> Complete Step {storeOrder!.followupStep}
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        </div>

        {/* Order navigator strip */}
        {pos.orders.length > 1 && (
          <div className="mb-4">
            <OrderNavigator orders={pos.orders} currentOrderId={orderId!} onOpen={openOrder} />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_360px] gap-4">
          {/* Left rail */}
          <div className="space-y-4">
            {/* Customer header */}
            <div className="rounded-xl border border-border bg-card p-4 card-shadow">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  {(customer?.name || order.customer_name || "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold truncate">{customer?.name || order.customer_name}</h2>
                  {customer && (
                    <p className="text-[11px] text-muted-foreground font-mono truncate">CID: {customer.id.slice(0, 8)}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span className="text-foreground font-medium">{customer?.mobile_number || order.mobile}</span>
                </p>
                <p className="flex items-start gap-1.5 text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="text-foreground">{customer?.address || order.address || "—"}</span>
                </p>
                {customer && (
                  <>
                    <p className="text-[11px] text-muted-foreground">
                      Customer since {customer.first_order_date || customer.created_at?.split("T")[0]}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      Stage: <span className="text-foreground">{customer.stage}</span> · {customer.is_active ? "Active" : "Inactive"}
                    </p>
                  </>
                )}
              </div>
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <Badge
                      key={t.id}
                      variant="outline"
                      className={cn("text-[10px] h-5", TAG_STYLE[t.tag] || "bg-muted text-muted-foreground border-border")}
                      title={t.reason || undefined}
                    >
                      {t.tag}
                    </Badge>
                  ))}
                </div>
              )}
              {customer && (
                <Link
                  to={`/customers/${customer.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open full customer profile <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>

            {/* Customer intelligence */}
            {customer && (
              <Section title="Customer Intelligence" icon={TrendingUp}>
                <div className="grid grid-cols-2 gap-3">
                  <KV label="Customer Since" value={customer.first_order_date || customer.created_at?.split("T")[0] || "—"} />
                  <KV label="Lifetime Value" value={`৳${(customer.lifetime_value || 0).toLocaleString()}`} />
                  <KV label="Total Orders" value={customer.total_orders} />
                  <KV label="Active Orders" value={customer.pending_orders} />
                  <KV label="Delivered" value={customer.delivered_orders} />
                  <KV label="Cancelled" value={customer.cancelled_orders} />
                  <KV label="Returned" value={customer.returned_orders} />
                  <KV label="Repeat" value={customer.repeat_orders} />
                  <KV label="Avg Order" value={`৳${Math.round(customer.avg_order_value || 0).toLocaleString()}`} />
                  <KV label="Last Product" value={customer.last_product || "—"} />
                  <KV label="Last Purchase" value={customer.last_order_date || "—"} />
                  <KV label="Last Followup" value={customer.last_followup_at ? fmtBST(customer.last_followup_at) : "—"} />
                  <KV label="Sales Exec" value={customer.last_executive_name || "—"} />
                </div>

              </Section>
            )}

            {/* AI Score */}
            <Section
              title="AI Customer Score"
              icon={Sparkles}
              action={
                <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" disabled={aiLoading} onClick={refreshAI}>
                  <RefreshCw className={cn("h-3 w-3", aiLoading && "animate-spin")} /> Refresh
                </Button>
              }
            >
              {aiError && <p className="text-xs text-destructive">{aiError}</p>}
              {!aiScore && aiLoading && <p className="text-xs text-muted-foreground">Computing AI score…</p>}
              {!aiScore && !aiLoading && !aiError && (
                <p className="text-xs text-muted-foreground">No score yet — click Refresh to generate.</p>
              )}
              {aiScore && (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Overall</p>
                      <p className="text-2xl font-bold text-foreground">{aiScore.scores?.overall ?? 0}<span className="text-sm text-muted-foreground">/100</span></p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {aiScore.model} · {fmtBST(aiScore.generated_at)}
                    </span>
                  </div>
                  <ScoreBar label="Health" value={aiScore.scores?.health} tone="success" why={aiScore.reasons?.health} />
                  <ScoreBar label="Repeat Probability" value={aiScore.scores?.repeat_probability} tone="info" why={aiScore.reasons?.repeat_probability} />
                  <ScoreBar label="Upsell Probability" value={aiScore.scores?.upsell_probability} tone="primary" why={aiScore.reasons?.upsell_probability} />
                  <ScoreBar label="Churn Risk" value={aiScore.scores?.churn_risk} tone="warning" why={aiScore.reasons?.churn_risk} />
                  <ScoreBar label="Payment Risk" value={aiScore.scores?.payment_risk} tone="destructive" why={aiScore.reasons?.payment_risk} />
                  <ScoreBar label="Engagement" value={aiScore.scores?.engagement} tone="info" why={aiScore.reasons?.engagement} />
                </div>
              )}
            </Section>

            {/* Order position intelligence */}
            <OrderPositionCard pos={pos} />

            {/* Related orders — full detail panel */}
            <RelatedOrdersPanel
              orders={pos.orders}
              currentOrderId={orderId!}
              onOpen={openOrder}
              prevOrderId={pos.prevOrderId}
              nextOrderId={pos.nextOrderId}
            />
          </div>

          {/* Center */}
          <div className="space-y-4 min-w-0">
            {/* Order header */}
            <div className="rounded-xl border border-border bg-card p-4 card-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-semibold text-foreground">
                      {order.generated_order_id || order.invoice_id || `#${order.id.slice(0, 8)}`}
                    </h1>
                    {order.is_repeat && <Badge variant="outline" className="text-[10px] h-5 border-warning/40 text-warning bg-warning/5">REPEAT</Badge>}
                    {order.is_upsell && <Badge variant="outline" className="text-[10px] h-5 border-info/40 text-info bg-info/5">UPSELL</Badge>}
                    <Badge variant="outline" className="text-[10px] h-5 capitalize">{order.current_status || "pending"}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KV label="Invoice" value={order.invoice_id || "—"} mono />
                    <KV label="External ID" value={order.external_order_id || "—"} mono />
                    <KV label="Tracking" value={order.tracking_code || "—"} mono />
                    <KV label="Source" value={order.order_source || "—"} />
                    <KV label="First Order" value={customer?.first_order_date || "—"} />
                    <KV label="Latest Order" value={customer?.last_order_date || "—"} />
                    <KV label="Total Orders" value={customer?.total_orders ?? "—"} />
                    <KV label="Position" value={pos.total ? (pos.isOnlyOrder ? "First Order" : `#${pos.position} of ${pos.total}`) : "—"} />
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full justify-start bg-muted/50 flex-wrap">
                <TabsTrigger value="info">Order Info</TabsTrigger>
                <TabsTrigger value="courier">Courier</TabsTrigger>
                <TabsTrigger value="payment">Payment</TabsTrigger>
                <TabsTrigger value="followup">Followup</TabsTrigger>
                <TabsTrigger value="order-timeline">Order Timeline</TabsTrigger>
                <TabsTrigger value="customer-timeline">Customer Timeline</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="import">Import</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                <Section title="Order Details" icon={Package}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <KV label="Product" value={order.product_title} />
                    <KV label="SKU" value={order.product_sku || "—"} mono />
                    <KV label="Amount (৳)" value={`৳${(order.price || 0).toLocaleString()}`} />
                    <KV label="Shipping (৳)" value={`৳${(order.shipping_charge || 0).toLocaleString()}`} />
                    <KV label="COD Charge (৳)" value={`৳${(order.cod_charge || 0).toLocaleString()}`} />
                    <KV label="Order Source" value={order.order_source || "—"} />
                    <KV label="Delivery Method" value={order.delivery_method || "—"} />
                    <KV label="Order Date" value={order.order_date || "—"} />
                    <KV label="Delivery Date" value={order.delivery_date || "—"} />
                    <KV label="Assigned To" value={order.assigned_to_name || "Unassigned"} />
                    <KV label="Followup Step" value={`${order.followup_step || 1} / 5`} />
                    <KV label="Health" value={<span className="capitalize">{order.health || "new"}</span>} />
                  </div>
                  {order.note && (
                    <div className="pt-3 mt-3 border-t border-border">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Note</p>
                      <p className="text-sm text-foreground">{order.note}</p>
                    </div>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="courier" className="mt-4">
                <Section title="Courier & Delivery" icon={Truck}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <KV label="Courier / Method" value={order.delivery_method || "—"} />
                    <KV label="Tracking Code" value={order.tracking_code || "—"} mono />
                    <KV label="Shipping (৳)" value={`৳${(order.shipping_charge || 0).toLocaleString()}`} />
                    <KV label="COD Charge (৳)" value={`৳${(order.cod_charge || 0).toLocaleString()}`} />
                    <KV label="Delivery Status" value={<span className="capitalize">{order.delivery_status || "—"}</span>} />
                    <KV label="Delivery Date" value={order.delivery_date || "—"} />
                    <KV label="Rider Name" value={order.rider_name || "—"} />
                    <KV label="Rider Phone" value={order.rider_phone || "—"} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Live courier API integration coming soon — status is currently updated manually or via bulk edit.
                  </p>
                </Section>
              </TabsContent>

              <TabsContent value="payment" className="mt-4">
                <Section title="Payment (COD)" icon={Wallet}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <KV label="Order Amount (৳)" value={`৳${(order.price || 0).toLocaleString()}`} />
                    <KV label="Shipping (৳)" value={`৳${(order.shipping_charge || 0).toLocaleString()}`} />
                    <KV label="COD Charge (৳)" value={`৳${(order.cod_charge || 0).toLocaleString()}`} />
                    <KV label="Total Collectable" value={`৳${((order.price || 0) + (order.shipping_charge || 0) + (order.cod_charge || 0)).toLocaleString()}`} />
                    <KV label="Delivery Status" value={<span className="capitalize">{order.delivery_status || "—"}</span>} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Payment ledger tracks COD amounts derived from delivery status. Explicit paid/due tracking will be added
                    when the finance module ships.
                  </p>
                </Section>
              </TabsContent>

              <TabsContent value="followup" className="mt-4">
                {storeOrder ? (
                  <Section title="Followup" icon={MessageSquare} action={
                    canComplete ? (
                      <Button size="sm" className="h-7 gap-1" onClick={() => setFollowupOpen(true)}>
                        <CheckCircle className="h-3.5 w-3.5" /> Complete Step {storeOrder.followupStep}
                      </Button>
                    ) : null
                  }>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <KV label="Current Step" value={`Step ${storeOrder.followupStep} / 5`} />
                      <KV label="Status" value={<span className="capitalize">{storeOrder.currentStatus || "pending"}</span>} />
                      <KV label="Next Followup" value={storeOrder.followupDate || "—"} />
                      <KV label="Health" value={<span className="capitalize">{storeOrder.health}</span>} />
                    </div>
                    {aiScore?.recommendations?.next_best_action?.action && (
                      <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-primary">AI Suggested Next Action</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">{aiScore.recommendations.next_best_action.action}</p>
                        {aiScore.recommendations.next_best_action.why && (
                          <p className="text-[11px] text-muted-foreground mt-1">{aiScore.recommendations.next_best_action.why}</p>
                        )}
                      </div>
                    )}
                  </Section>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading followup context…</p>
                )}
              </TabsContent>

              <TabsContent value="order-timeline" className="mt-4">
                <Section title="Order Timeline" icon={Calendar}>
                  {orderTimelineLoading && <Skeleton className="h-24" />}
                  {!orderTimelineLoading && orderTimeline.length === 0 && (
                    <p className="text-xs text-muted-foreground">No events yet.</p>
                  )}
                  <div className="space-y-2 max-h-[520px] overflow-y-auto">
                    {orderTimeline.map((ev) => (
                      <div key={ev.id} className="flex gap-3 text-xs">
                        <div className="w-32 shrink-0 text-muted-foreground">{fmtBST(ev.at)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{ev.title}</p>
                          {ev.detail && <p className="text-muted-foreground">{ev.detail}</p>}
                          {ev.actor && <p className="text-[10px] text-muted-foreground">by {ev.actor}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </TabsContent>

              <TabsContent value="customer-timeline" className="mt-4">
                <Section title="Customer Timeline" icon={User}>
                  {custTimelineLoading && <Skeleton className="h-24" />}
                  {!custTimelineLoading && custTimeline.length === 0 && (
                    <p className="text-xs text-muted-foreground">No events yet.</p>
                  )}
                  <div className="space-y-2 max-h-[520px] overflow-y-auto">
                    {custTimeline.slice(0, 100).map((ev) => (
                      <div key={ev.id} className="flex gap-3 text-xs">
                        <div className="w-32 shrink-0 text-muted-foreground">{fmtBST(ev.at)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{ev.title}</p>
                          {ev.detail && <p className="text-muted-foreground">{ev.detail}</p>}
                          {ev.actor && <p className="text-[10px] text-muted-foreground">by {ev.actor}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <Section title="Activity History (with change diffs)">
                  <ActivityDiffViewer logs={activityLogs} loading={activityLoading} hasMore={activityHasMore} onLoadMore={activityLoadMore} />
                </Section>
              </TabsContent>

              <TabsContent value="import" className="mt-4">
                <ImportInfoCard order={order} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right rail */}
          <div className="space-y-4">
            <Section title="Quick Actions">
              <div className="grid grid-cols-2 gap-2">
                {customer && (
                  <Button size="sm" variant="outline" className="justify-start gap-1.5" asChild>
                    <Link to={`/customers/${customer.id}`}><User className="h-3.5 w-3.5" /> Profile</Link>
                  </Button>
                )}
                {canComplete && (
                  <Button size="sm" variant="outline" className="justify-start gap-1.5" onClick={() => setFollowupOpen(true)}>
                    <CheckCircle className="h-3.5 w-3.5" /> Followup
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="outline" className="justify-start gap-1.5" onClick={() => setEditOpen(true)}>
                    <Edit2 className="h-3.5 w-3.5" /> Edit Order
                  </Button>
                )}
                <Button size="sm" variant="outline" className="justify-start gap-1.5" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <Button size="sm" variant="outline" className="justify-start gap-1.5" asChild>
                  <Link to="/orders"><FileDown className="h-3.5 w-3.5" /> Orders</Link>
                </Button>
                <Button size="sm" variant="outline" className="justify-start gap-1.5" asChild>
                  <Link to="/repeat-orders"><Repeat2 className="h-3.5 w-3.5" /> Repeats</Link>
                </Button>
                {canDelete && (
                  <Button size="sm" variant="destructive" className="justify-start gap-1.5 col-span-2" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete Order
                  </Button>
                )}
              </div>
            </Section>


            <Section title="AI Recommendations" icon={Sparkles}>
              {!aiScore && <p className="text-xs text-muted-foreground">Generate the AI score to see recommendations.</p>}
              {aiScore && (
                <div className="space-y-2 text-xs">
                  <AIRecommendationCard label="Next Best Action" rec={aiScore.recommendations?.next_best_action} field="action" />
                  <AIRecommendationCard label="Recommended Product" rec={aiScore.recommendations?.recommended_product} field="product" />
                  <AIRecommendationCard label="Recommended Upsell" rec={aiScore.recommendations?.recommended_upsell} field="product" />
                  <AIRecommendationCard label="Followup Timing" rec={aiScore.recommendations?.recommended_followup_time} field="when" />
                  <AIRecommendationCard label="Customer Risk" rec={aiScore.recommendations?.customer_risk} field="level" priority={((aiScore.recommendations?.customer_risk as any)?.level || "medium").toLowerCase() as any} />
                </div>
              )}
            </Section>

            <Section title="AI Sales Assistant" icon={Sparkles}>
              <p className="text-xs text-muted-foreground">
                Open the global AI Assistant from the sidebar to ask context-aware questions about this customer and order.
                The assistant respects your role permissions.
              </p>
            </Section>
          </div>
        </div>

        {/* Dialogs — reuse existing flows */}
        {storeOrder && (
          <>
            <EditOrderDialog order={storeOrder} open={editOpen} onOpenChange={setEditOpen} />
            <CompleteFollowupDialog order={storeOrder} open={followupOpen} onOpenChange={setFollowupOpen} onComplete={completeFollowup} />
            {canDelete && (
              <DeleteOrderDialog
                order={storeOrder}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onConfirm={async (reason) => { await softDelete(storeOrder.id, reason); navigate("/orders"); }}
              />
            )}
          </>
        )}

      </div>
    </AppLayout>
  );
}

function ImportInfoCard({ order }: { order: any }) {
  const { run, loading } = useImportRunInfo(order?.import_run_id);

  if (!order?.import_run_id) {
    return (
      <Section title="Import Information" icon={ShieldAlert}>
        <div className="rounded-md border border-dashed border-border p-3">
          <p className="text-xs font-medium text-foreground">Created Manually</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            This order was not created through the bulk import engine.
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Import Information" icon={ShieldAlert}>
      {loading && <Skeleton className="h-16" />}
      {!loading && !run && <p className="text-xs text-muted-foreground">Import run no longer available.</p>}
      {run && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KV label="Import Source" value={run.source || run.courier_name || "—"} />
          <KV label="Imported By" value={run.created_by_name || run.uploaded_by_name || "—"} />
          <KV label="Import Date (BST)" value={fmtBST(run.started_at || run.created_at)} />
          <KV label="Original File" value={run.original_file_name || run.file_name || "—"} />
          <KV label="Import Run ID" value={run.id?.slice(0, 8) || "—"} mono />
          <KV label="Import Batch" value={`${run.processed_batches || 0} / ${run.total_batches || 0}`} />
          <KV label="Health Score" value={(run.health_score?.overall ?? "—") + (run.health_score?.overall != null ? " / 100" : "")} />
          <KV label="AI Corrections" value={run.cleaned_rows ?? "—"} />
          <KV label="Status" value={<span className="capitalize">{run.status || "—"}</span>} />
        </div>
      )}
    </Section>
  );
}
