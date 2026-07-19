import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/contexts/PermissionContext";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, ExternalLink, Loader2, Package, Phone, Repeat2, User, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { formatBSTDateTime } from "@/lib/bst";

export type DuplicateAction =
  | "skip"
  | "create_additional"
  | "update_existing"
  | "merge_orders"
  | "open_profile"
  | "cancel";

export interface DuplicateDetection {
  case:
    | "none"
    | "same_order_id"
    | "same_mobile_same_order_id"
    | "existing_customer_new_order"
    | "same_tracking"
    | "same_invoice";
  customer_id: string | null;
  duplicate_order_id: string | null;
  matched_by: {
    mobile: boolean;
    external_order_id: boolean;
    tracking_code: boolean;
    invoice_no: boolean;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detection: DuplicateDetection | null;
  incomingSummary?: { customerName: string; mobile: string; product?: string; amount?: number };
  onAction: (action: DuplicateAction) => Promise<void> | void;
}

const CASE_COPY: Record<DuplicateDetection["case"], { title: string; sub: string }> = {
  none: { title: "", sub: "" },
  same_order_id: { title: "Duplicate Order ID", sub: "An order with this ID already exists in your project." },
  same_mobile_same_order_id: {
    title: "Duplicate Order",
    sub: "This customer already has an order with the same Order ID.",
  },
  existing_customer_new_order: {
    title: "Existing Customer Found",
    sub: "This mobile number belongs to a customer you already have.",
  },
  same_tracking: { title: "Duplicate Tracking Code", sub: "Another active order uses this tracking code." },
  same_invoice: { title: "Duplicate Invoice", sub: "Another active order uses this invoice number." },
};

export default function DuplicateOrderDialog({ open, onOpenChange, detection, incomingSummary, onAction }: Props) {
  const { hasPermission } = usePermissions();
  const { role } = useAuth();
  const [customer, setCustomer] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [dupOrder, setDupOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<DuplicateAction | null>(null);

  const isOwner = role === "owner";
  const can = (k: string) => isOwner || hasPermission(k);

  useEffect(() => {
    if (!open || !detection) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (detection.customer_id) {
          const { data: c } = await supabase
            .from("customers").select("*").eq("id", detection.customer_id).maybeSingle();
          if (!cancelled) setCustomer(c);
          const { data: os } = await supabase
            .from("orders")
            .select("id, invoice_id, product_title, price, delivery_status, current_status, order_date, is_deleted")
            .eq("customer_id", detection.customer_id)
            .eq("is_deleted", false)
            .order("order_date", { ascending: false })
            .limit(20);
          if (!cancelled) setOrders(os || []);
        } else {
          setCustomer(null); setOrders([]);
        }
        if (detection.duplicate_order_id) {
          const { data: o } = await supabase
            .from("orders").select("*").eq("id", detection.duplicate_order_id).maybeSingle();
          if (!cancelled) setDupOrder(o);
        } else {
          setDupOrder(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, detection?.customer_id, detection?.duplicate_order_id]);

  const caseCopy = detection ? CASE_COPY[detection.case] : CASE_COPY.none;

  const showCreate = useMemo(() => {
    if (!detection) return false;
    // Case 2: existing customer + new order → creating another is the primary action
    if (detection.case === "existing_customer_new_order") return can("duplicates.allow_duplicate_order");
    // All other cases: allow force-create only with elevated permission
    return can("duplicates.force_create");
  }, [detection, hasPermission, role]);

  const showUpdate = detection?.duplicate_order_id && can("duplicates.update_existing");
  const showMerge = detection?.duplicate_order_id && can("duplicates.merge_orders");
  const showOpenProfile = detection?.customer_id && can("duplicates.open_customer_profile");

  const handle = async (a: DuplicateAction) => {
    setBusy(a);
    try { await onAction(a); } finally { setBusy(null); }
  };

  if (!detection || detection.case === "none") return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {caseCopy.title}
          </DialogTitle>
          <DialogDescription>{caseCopy.sub}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-4 pb-2">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading customer history…
              </div>
            )}

            {incomingSummary && (
              <section className="rounded-md border border-dashed p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Incoming Order
                </div>
                <div className="grid grid-cols-2 gap-y-1">
                  <Field icon={User} label="Name" value={incomingSummary.customerName} />
                  <Field icon={Phone} label="Phone" value={incomingSummary.mobile} />
                  {incomingSummary.product && <Field icon={Package} label="Product" value={incomingSummary.product} />}
                  {incomingSummary.amount != null && (
                    <Field icon={Wallet} label="Amount" value={`৳${incomingSummary.amount.toLocaleString()}`} />
                  )}
                </div>
              </section>
            )}

            {customer && (
              <section className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Existing Customer
                  </div>
                  {customer.is_repeat_customer && (
                    <Badge variant="outline" className="h-5 gap-1 bg-info/10 text-info border-info/30 text-[10px]">
                      <Repeat2 className="h-3 w-3" /> Repeat
                    </Badge>
                  )}
                </div>
                <div className="text-base font-semibold">{customer.name}</div>
                <div className="text-xs text-muted-foreground mb-3">
                  {customer.mobile_number}
                  {customer.first_order_date && (
                    <> • Since {new Date(customer.first_order_date).toLocaleDateString()}</>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <Stat label="Total" value={customer.total_orders} />
                  <Stat label="Delivered" value={customer.delivered_orders} tone="success" />
                  <Stat label="Cancelled" value={customer.cancelled_orders} tone="destructive" />
                  <Stat label="Returned" value={customer.returned_orders} tone="warning" />
                  <Stat label="Pending" value={customer.pending_orders} />
                  <Stat label="Repeat" value={customer.repeat_orders} />
                  <Stat label="LTV" value={`৳${Number(customer.lifetime_value || 0).toLocaleString()}`} />
                  <Stat label="AOV" value={`৳${Math.round(Number(customer.avg_order_value || 0)).toLocaleString()}`} />
                </div>
                {(customer.last_executive_name || customer.last_followup_at || customer.last_product) && (
                  <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                    {customer.last_product && <div>Last product: {customer.last_product}</div>}
                    {customer.last_executive_name && <div>Current executive: {customer.last_executive_name}</div>}
                    {customer.last_followup_at && (
                      <div>Last followup: {formatBSTDateTime(customer.last_followup_at)}</div>
                    )}
                  </div>
                )}
              </section>
            )}

            {dupOrder && (
              <section className="rounded-md border p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Matching Order
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <Field label="Order ID" value={dupOrder.invoice_id || dupOrder.external_order_id || dupOrder.id.slice(0, 8)} />
                  <Field label="Status" value={dupOrder.delivery_status || dupOrder.current_status} />
                  <Field label="Product" value={dupOrder.product_title} />
                  <Field label="Amount" value={`৳${Number(dupOrder.price || 0).toLocaleString()}`} />
                  {dupOrder.order_date && <Field label="Order Date" value={new Date(dupOrder.order_date).toLocaleDateString()} />}
                  {dupOrder.tracking_code && <Field label="Tracking" value={dupOrder.tracking_code} />}
                </div>
              </section>
            )}

            {orders.length > 0 && (
              <section>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Recent Orders ({orders.length})
                </div>
                <div className="rounded-md border divide-y">
                  {orders.map((o, i) => (
                    <div key={o.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-muted-foreground">#{orders.length - i}</span>
                        <span className="truncate">{o.product_title || "—"}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className="h-5 text-[10px] capitalize">
                          {o.delivery_status || o.current_status}
                        </Badge>
                        <span className="font-mono">৳{Number(o.price || 0).toLocaleString()}</span>
                        <span className="text-muted-foreground w-16 text-right">
                          {o.order_date ? new Date(o.order_date).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {showOpenProfile && customer && (
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to={`/customers/${customer.id}`} target="_blank" rel="noopener">
                <ExternalLink className="h-3.5 w-3.5" /> Open Customer Profile
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => handle("cancel")} disabled={!!busy}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handle("skip")} disabled={!!busy}>
            {busy === "skip" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Skip Duplicate
          </Button>
          {showUpdate && (
            <Button variant="outline" size="sm" onClick={() => handle("update_existing")} disabled={!!busy}>
              {busy === "update_existing" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Update Existing
            </Button>
          )}
          {showMerge && (
            <Button variant="outline" size="sm" onClick={() => handle("merge_orders")} disabled={!!busy}>
              {busy === "merge_orders" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Merge Information
            </Button>
          )}
          {showCreate && (
            <Button size="sm" onClick={() => handle("create_additional")} disabled={!!busy}>
              {busy === "create_additional" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              {detection.case === "existing_customer_new_order" ? "Create New Order" : "Force Create"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ icon: Icon, label, value }: { icon?: any; label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground shrink-0" />}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium truncate">{value ?? "—"}</span>
    </div>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: any; tone?: "muted" | "success" | "warning" | "destructive" }) {
  const toneCls: Record<string, string> = {
    muted: "bg-muted/40",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <div className={`rounded px-2 py-1.5 ${toneCls[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="font-semibold">{value ?? 0}</div>
    </div>
  );
}
