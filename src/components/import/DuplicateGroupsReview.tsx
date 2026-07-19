import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Eye, Users, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export type DupAction = "skip" | "create" | "update" | "merge";

export interface ExistingOrderLite {
  id: string;
  external_order_id: string | null;
  product_title: string | null;
  price: number | null;
  order_date: string | null;
  delivery_status: string | null;
  tracking_code?: string | null;
  invoice_no?: string | null;
}

export interface DuplicateGroup {
  mobile: string;                    // normalized mobile
  customerId: string | null;         // existing customer id (may be null if only order matches)
  customerName: string;
  existingOrders: ExistingOrderLite[]; // count in DB
  existingCount: number;
  incomingCount: number;
  incomingRowNumbers: number[];      // row numbers of the incoming duplicate rows
  matchedOrderIds: string[];         // external_order_id matches
  matchedTrackingCodes: string[];
  matchedInvoices: string[];
  suggestedAction?: DupAction;       // from learning
}

export interface DupDecisionState {
  version: 2;
  global?: DupAction | null;
  customers: Record<string, DupAction>;      // by mobile
  orders: Record<string, DupAction>;         // by externalOrderId
}

interface Props {
  groups: DuplicateGroup[];
  decisions: DupDecisionState;
  onDecisions: (next: DupDecisionState) => void;
  onPreview: (mobile: string, customerId: string | null) => void;
}

const ACTION_LABEL: Record<DupAction, string> = {
  skip: "Skip",
  create: "Create New Order",
  update: "Update Existing",
  merge: "Merge Information",
};

export default function DuplicateGroupsReview({ groups, decisions, onDecisions, onPreview }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const totals = useMemo(() => {
    return {
      customers: groups.length,
      incoming: groups.reduce((n, g) => n + g.incomingCount, 0),
      existing: groups.reduce((n, g) => n + g.existingCount, 0),
    };
  }, [groups]);

  const setCustomerAction = (mobile: string, a: DupAction) =>
    onDecisions({ ...decisions, customers: { ...decisions.customers, [mobile]: a } });

  const applyAll = (a: DupAction) =>
    onDecisions({ ...decisions, global: a, customers: {}, orders: {} });

  const applyByType = (type: "order_id" | "tracking" | "invoice" | "mobile", a: DupAction) => {
    const next = { ...decisions, customers: { ...decisions.customers }, orders: { ...decisions.orders } };
    groups.forEach((g) => {
      const matches =
        (type === "order_id" && g.matchedOrderIds.length > 0) ||
        (type === "tracking" && g.matchedTrackingCodes.length > 0) ||
        (type === "invoice" && g.matchedInvoices.length > 0) ||
        (type === "mobile" && g.existingCount > 0);
      if (!matches) return;
      next.customers[g.mobile] = a;
      if (type === "order_id") g.matchedOrderIds.forEach((id) => (next.orders[id] = a));
    });
    onDecisions(next);
  };

  const effectiveAction = (g: DuplicateGroup): DupAction => {
    return (
      decisions.customers[g.mobile] ||
      g.suggestedAction ||
      decisions.global ||
      "update"
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 card-shadow flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> <b>{totals.customers}</b> duplicate customers</div>
          <div className="flex items-center gap-1.5"><Package className="h-4 w-4 text-primary" /> <b>{totals.incoming}</b> incoming vs <b>{totals.existing}</b> existing</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Apply to all:</span>
          {(["skip", "update", "create", "merge"] as DupAction[]).map((a) => (
            <Button key={a} size="sm" variant="outline" className="h-7" onClick={() => applyAll(a)}>
              {ACTION_LABEL[a]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2 text-xs card-shadow">
        <span className="text-muted-foreground">Apply by match type:</span>
        {(["order_id", "tracking", "invoice", "mobile"] as const).map((t) => (
          <div key={t} className="flex items-center gap-1 border border-border rounded px-2 py-1">
            <span className="capitalize">{t.replace("_", " ")}</span>
            <Select onValueChange={(v) => applyByType(t, v as DupAction)}>
              <SelectTrigger className="h-6 w-[120px] text-xs"><SelectValue placeholder="Action…" /></SelectTrigger>
              <SelectContent>
                {(["skip", "update", "create", "merge"] as DupAction[]).map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_LABEL[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-xl divide-y divide-border max-h-[520px] overflow-auto bg-card">
        {groups.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">No duplicates found.</p>
        )}
        {groups.map((g) => {
          const isOpen = !!expanded[g.mobile];
          const action = effectiveAction(g);
          return (
            <div key={g.mobile} className="p-3 text-sm">
              <div className="flex items-center gap-2">
                <button
                  className="p-0.5 hover:bg-muted rounded"
                  onClick={() => setExpanded((e) => ({ ...e, [g.mobile]: !isOpen }))}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{g.customerName || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{g.mobile}</p>
                </div>
                <div className="hidden md:flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">Existing: {g.existingCount}</Badge>
                  <Badge variant="secondary" className="text-[10px]">Incoming: {g.incomingCount}</Badge>
                  {g.matchedOrderIds.length > 0 && <Badge variant="outline" className="text-[10px]">Order ID</Badge>}
                  {g.matchedTrackingCodes.length > 0 && <Badge variant="outline" className="text-[10px]">Tracking</Badge>}
                  {g.matchedInvoices.length > 0 && <Badge variant="outline" className="text-[10px]">Invoice</Badge>}
                </div>
                <Select value={action} onValueChange={(v) => setCustomerAction(g.mobile, v as DupAction)}>
                  <SelectTrigger className={cn("h-8 w-[170px] text-xs", g.suggestedAction && !decisions.customers[g.mobile] && "border-primary/40")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["skip", "update", "create", "merge"] as DupAction[]).map((a) => (
                      <SelectItem key={a} value={a}>
                        {ACTION_LABEL[a]}
                        {g.suggestedAction === a && !decisions.customers[g.mobile] && " (suggested)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => onPreview(g.mobile, g.customerId)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                </Button>
              </div>

              {isOpen && (
                <div className="mt-3 ml-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="border border-border rounded-lg p-2">
                    <p className="uppercase text-[10px] font-semibold mb-1">Existing orders ({g.existingOrders.length}{g.existingCount > g.existingOrders.length ? ` of ${g.existingCount}` : ""})</p>
                    <div className="space-y-1">
                      {g.existingOrders.slice(0, 10).map((o) => (
                        <div key={o.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">{o.external_order_id || o.id.slice(0, 8)} · {o.product_title || "—"}</span>
                          <span className="shrink-0 text-muted-foreground">৳{Math.round(Number(o.price || 0))}</span>
                        </div>
                      ))}
                      {g.existingCount > 10 && <p className="text-muted-foreground text-[10px] mt-1">+ {g.existingCount - 10} more…</p>}
                    </div>
                  </div>
                  <div className="border border-border rounded-lg p-2">
                    <p className="uppercase text-[10px] font-semibold mb-1">Incoming rows ({g.incomingCount})</p>
                    <p className="text-muted-foreground break-words">
                      Row numbers: {g.incomingRowNumbers.slice(0, 30).join(", ")}
                      {g.incomingRowNumbers.length > 30 && ` +${g.incomingRowNumbers.length - 30} more`}
                    </p>
                    {g.matchedOrderIds.length > 0 && (
                      <p className="mt-1 text-muted-foreground">Order IDs matched: {g.matchedOrderIds.slice(0, 5).join(", ")}{g.matchedOrderIds.length > 5 && "…"}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
