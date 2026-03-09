import { useState, useMemo, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useRole } from "@/contexts/RoleContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Target, DollarSign, TrendingUp, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Executive {
  userId: string;
  name: string;
  email: string;
}

interface CommissionConfig {
  executiveId: string;
  enabled: boolean;
  type: "percentage" | "fixed";
  rate: number;
}

interface CommissionEntry {
  id: string;
  executiveId: string;
  orderId: string;
  orderDate: string;
  amount: number;
  status: "pending" | "paid";
  paidDate?: string;
  paymentNote?: string;
}

export default function CommissionPage() {
  const { isAdmin } = useRole();
  const { addLog } = useAuditLog();
  const { toast } = useToast();

  const [executives, setExecutives] = useState<Executive[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Commission configs stored in-memory (no DB table yet)
  const [configs, setConfigs] = useState<CommissionConfig[]>([]);
  const [entries, setEntries] = useState<CommissionEntry[]>([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedExec, setSelectedExec] = useState("all");
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingEntry, setPayingEntry] = useState<CommissionEntry | null>(null);
  const [paymentNote, setPaymentNote] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch SE user IDs
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "sales_executive");

    const seUserIds = (roles || []).map((r) => r.user_id);

    if (seUserIds.length === 0) {
      setExecutives([]);
      setOrders([]);
      setLoading(false);
      return;
    }

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name");

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name || ""]));

    const execs: Executive[] = seUserIds.map((uid) => ({
      userId: uid,
      name: profileMap.get(uid) || "Unknown",
      email: "",
    }));
    setExecutives(execs);

    // Initialize configs for new executives (preserve existing)
    setConfigs((prev) => {
      const existingMap = new Map(prev.map((c) => [c.executiveId, c]));
      return execs.map((e) =>
        existingMap.get(e.userId) || {
          executiveId: e.userId,
          enabled: false,
          type: "percentage" as const,
          rate: 5,
        }
      );
    });

    // Fetch orders assigned to these SEs
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .eq("is_deleted", false)
      .in("assigned_to", seUserIds);

    setOrders(ordersData || []);

    // Generate commission entries from repeat orders
    const repeatOrders = (ordersData || []).filter((o) => o.is_repeat && o.parent_order_id);
    setEntries((prevEntries) => {
      const existingIds = new Set(prevEntries.map((e) => e.id));
      const newEntries = repeatOrders
        .filter((o) => !existingIds.has(o.id))
        .map((o) => ({
          id: o.id,
          executiveId: o.assigned_to || "",
          orderId: o.invoice_id || o.generated_order_id || o.id.slice(0, 8),
          orderDate: o.order_date,
          amount: Math.round(Number(o.price || 0) * 0.05),
          status: "pending" as const,
        }));
      // Keep existing entries that still have valid executives
      const validPrev = prevEntries.filter((e) => seUserIds.includes(e.executiveId));
      // Merge: keep paid status from existing
      const mergedMap = new Map(validPrev.map((e) => [e.id, e]));
      newEntries.forEach((ne) => { if (!mergedMap.has(ne.id)) mergedMap.set(ne.id, ne); });
      return Array.from(mergedMap.values());
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("commission-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedExec !== "all" && e.executiveId !== selectedExec) return false;
      if (dateFrom && e.orderDate < dateFrom) return false;
      if (dateTo && e.orderDate > dateTo) return false;
      return true;
    });
  }, [entries, selectedExec, dateFrom, dateTo]);

  const totalEarned = filteredEntries.reduce((s, e) => s + e.amount, 0);
  const totalPaid = filteredEntries.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const totalPending = totalEarned - totalPaid;

  const execNameMap = useMemo(() => new Map(executives.map((e) => [e.userId, e.name])), [executives]);

  const targetProgress = useMemo(() => {
    return executives.map((se) => {
      const config = configs.find((c) => c.executiveId === se.userId);
      const seOrders = orders.filter((o) => o.assigned_to === se.userId);
      const repeatOrders = seOrders.filter((o) => o.is_repeat && o.parent_order_id).length;
      const upsellOrders = seOrders.filter((o) => o.is_upsell).length;
      const revenue = seOrders.reduce((s, o) => s + Number(o.price || 0), 0);

      // Default targets
      const targetRepeatOrders = 10;
      const targetRevenue = 50000;
      const targetUpsellCount = 5;

      return {
        exec: se,
        config,
        repeatOrders,
        upsellOrders,
        revenue,
        targetRepeatOrders,
        targetRevenue,
        targetUpsellCount,
        repeatPct: Math.min(100, (repeatOrders / targetRepeatOrders) * 100),
        revenuePct: Math.min(100, (revenue / targetRevenue) * 100),
        upsellPct: Math.min(100, (upsellOrders / targetUpsellCount) * 100),
      };
    });
  }, [executives, orders, configs]);

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Access restricted to Admin only.
        </div>
      </AppLayout>
    );
  }

  const toggleCommission = (execId: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.executiveId === execId ? { ...c, enabled: !c.enabled } : c))
    );
    const exec = executives.find((se) => se.userId === execId);
    const config = configs.find((c) => c.executiveId === execId);
    addLog({
      actionType: config?.enabled ? "Commission Disabled" : "Commission Enabled",
      userName: "Admin User",
      role: "admin",
      entity: exec?.name || execId,
    });
    toast({ title: "Updated", description: `Commission ${config?.enabled ? "disabled" : "enabled"} for ${exec?.name}.` });
  };

  const handleMarkPaid = () => {
    if (!payingEntry) return;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === payingEntry.id
          ? { ...e, status: "paid" as const, paidDate: new Date().toISOString().slice(0, 10), paymentNote }
          : e
      )
    );
    const execName = execNameMap.get(payingEntry.executiveId) || "Unknown";
    addLog({
      actionType: "Commission Marked Paid",
      userName: "Admin User",
      role: "admin",
      entity: `${execName} - ${payingEntry.orderId}`,
      details: `৳${payingEntry.amount}${paymentNote ? ` — ${paymentNote}` : ""}`,
    });
    toast({ title: "Marked as Paid", description: `৳${payingEntry.amount} commission marked as paid.` });
    setPayDialogOpen(false);
    setPayingEntry(null);
    setPaymentNote("");
  };

  return (
    <AppLayout>
      <PageHeader title="Targets & Commission" description="Sales targets, commission tracking, and payouts" />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
            <div className="rounded-xl border border-border bg-card p-4 card-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Commission</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">৳{totalEarned.toLocaleString()}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 card-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Paid</p>
                  <p className="mt-1 text-xl font-bold text-success">৳{totalPaid.toLocaleString()}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "hsl(var(--success) / 0.1)" }}>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 card-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pending</p>
                  <p className="mt-1 text-xl font-bold" style={{ color: "hsl(var(--warning))" }}>৳{totalPending.toLocaleString()}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "hsl(var(--warning) / 0.1)" }}>
                  <TrendingUp className="h-4 w-4" style={{ color: "hsl(var(--warning))" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Target Progress */}
          <div className="mb-6 animate-fade-in">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" /> Monthly Targets
            </h2>
            {executives.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 card-shadow text-center text-muted-foreground">
                No sales executives found.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {targetProgress.map(({ exec, config, repeatOrders, upsellOrders, revenue, targetRepeatOrders, targetRevenue, targetUpsellCount, repeatPct, revenuePct, upsellPct }) => (
                  <div key={exec.userId} className="rounded-xl border border-border bg-card p-5 card-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {exec.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{exec.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Commission</span>
                        <Switch checked={config?.enabled ?? false} onCheckedChange={() => toggleCommission(exec.userId)} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Repeat Orders</span>
                          <span className="font-medium text-foreground">{repeatOrders}/{targetRepeatOrders}</span>
                        </div>
                        <Progress value={repeatPct} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="font-medium text-foreground">৳{revenue.toLocaleString()}/৳{targetRevenue.toLocaleString()}</span>
                        </div>
                        <Progress value={revenuePct} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Upsell Count</span>
                          <span className="font-medium text-foreground">{upsellOrders}/{targetUpsellCount}</span>
                        </div>
                        <Progress value={upsellPct} className="h-2" />
                      </div>
                    </div>

                    {config?.enabled && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Commission: {config.type === "percentage" ? `${config.rate}% of repeat order revenue` : `৳${config.rate} per repeat order`}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commission Entries */}
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Commission Ledger
          </h2>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 card-shadow animate-fade-in">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Executive</label>
              <Select value={selectedExec} onValueChange={setSelectedExec}>
                <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Executives</SelectItem>
                  {executives.filter((se) => configs.find((c) => c.executiveId === se.userId)?.enabled).map((se) => (
                    <SelectItem key={se.userId} value={se.userId}>{se.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Entries table */}
          <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Executive</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-foreground">{execNameMap.get(entry.executiveId) || "Unknown"}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.orderId}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.orderDate}</TableCell>
                    <TableCell className="text-right font-semibold">৳{entry.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === "paid" ? "default" : "secondary"} className="text-[11px]">
                        {entry.status === "paid" ? "Paid" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.paymentNote || "—"}</TableCell>
                    <TableCell className="text-right">
                      {entry.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setPayingEntry(entry);
                            setPaymentNote("");
                            setPayDialogOpen(true);
                          }}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                      No commission entries found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Commission as Paid</DialogTitle>
          </DialogHeader>
          {payingEntry && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{execNameMap.get(payingEntry.executiveId) || "Unknown"}</span>
                  {" — "}Order {payingEntry.orderId}
                </p>
                <p className="text-lg font-bold text-foreground mt-1">৳{payingEntry.amount.toLocaleString()}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Note (optional)</Label>
                <Textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g., Bank transfer, Cash..."
                  className="resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
