import { useState, useMemo, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Target, DollarSign, TrendingUp, CheckCircle2, Loader2, Settings2, Plus, ChevronDown, Ban,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CommissionConfigDialog, { type CommissionConfigData } from "@/components/CommissionConfigDialog";
import SalesTargetDialog, { type SalesTargetData } from "@/components/SalesTargetDialog";
import AddManualCommissionDialog from "@/components/AddManualCommissionDialog";

interface Executive {
  userId: string;
  name: string;
}

interface CommissionEntry {
  id: string;
  executive_id: string;
  order_id: string | null;
  order_invoice: string;
  amount: number;
  status: string;
  source: string;
  paid_date: string | null;
  payment_note: string;
  paid_by: string | null;
  created_at: string;
}

export default function CommissionPage() {
  const { isAdmin } = useRole();
  const { profile, user } = useAuth();
  const { addLog } = useAuditLog();
  const { toast } = useToast();
  const projectId = profile?.project_id || "";

  const [executives, setExecutives] = useState<Executive[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [configs, setConfigs] = useState<CommissionConfigData[]>([]);
  const [targets, setTargets] = useState<SalesTargetData[]>([]);
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedExec, setSelectedExec] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dialogs
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<{ config: CommissionConfigData; name: string } | null>(null);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{ target: SalesTargetData | null; execId: string; name: string } | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingEntry, setPayingEntry] = useState<CommissionEntry | null>(null);
  const [paymentNote, setPaymentNote] = useState("");

  // Bulk pay
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    // Fetch SEs
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "sales_executive");
    const seUserIds = (roles || []).map((r) => r.user_id);

    // Fetch profiles
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name || "Unknown"]));
    const execs: Executive[] = seUserIds.map((uid) => ({ userId: uid, name: profileMap.get(uid) || "Unknown" }));
    setExecutives(execs);

    if (seUserIds.length > 0) {
      // Fetch orders, followups, configs, targets, entries in parallel
      const [ordersRes, followupsRes, configsRes, targetsRes, entriesRes] = await Promise.all([
        supabase.from("orders").select("*").eq("is_deleted", false).in("assigned_to", seUserIds),
        supabase.from("followup_history").select("order_id, step_number, completed_by"),
        supabase.from("commission_configs").select("*").eq("project_id", projectId),
        supabase.from("sales_targets").select("*").eq("project_id", projectId).eq("is_active", true),
        supabase.from("commission_entries").select("*").eq("project_id", projectId),
      ]);

      setOrders(ordersRes.data || []);
      setFollowups(followupsRes.data || []);
      setConfigs((configsRes.data || []) as any);
      setTargets((targetsRes.data || []) as any);
      setEntries((entriesRes.data || []) as any);
    } else {
      setOrders([]);
      setFollowups([]);
      setConfigs([]);
      setTargets([]);
      setEntries([]);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("commission-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "commission_configs" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_targets" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "commission_entries" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const execNameMap = useMemo(() => new Map(executives.map((e) => [e.userId, e.name])), [executives]);

  const getConfig = (execId: string) => configs.find((c) => c.executive_id === execId);
  const getTarget = (execId: string) => targets.find((t) => t.executive_id === execId);

  // ========== CONFIG ACTIONS ==========
  const handleSaveConfig = async (data: CommissionConfigData) => {
    const payload = { ...data, project_id: projectId };
    if (data.id) {
      await supabase.from("commission_configs").update(payload).eq("id", data.id);
    } else {
      await supabase.from("commission_configs").upsert(payload, { onConflict: "executive_id,project_id" });
    }
    const execName = execNameMap.get(data.executive_id) || "";
    addLog({ actionType: "Commission Config Updated", userName: profile?.full_name || "Admin", role: "admin", entity: execName });
    toast({ title: "Saved", description: `Commission settings updated for ${execName}.` });
    fetchData();
  };

  const quickToggleCommission = async (execId: string) => {
    const existing = getConfig(execId);
    if (existing?.id) {
      await supabase.from("commission_configs").update({ enabled: !existing.enabled }).eq("id", existing.id);
    } else {
      await supabase.from("commission_configs").upsert({
        executive_id: execId, project_id: projectId, enabled: true,
      }, { onConflict: "executive_id,project_id" });
    }
    const name = execNameMap.get(execId) || "";
    toast({ title: "Updated", description: `Commission ${existing?.enabled ? "disabled" : "enabled"} for ${name}.` });
    fetchData();
  };

  // ========== TARGET ACTIONS ==========
  const handleSaveTarget = async (data: SalesTargetData) => {
    const payload = { ...data, project_id: projectId };
    if (data.id) {
      await supabase.from("sales_targets").update(payload).eq("id", data.id);
    } else {
      // Deactivate old targets for this exec
      await supabase.from("sales_targets").update({ is_active: false }).eq("executive_id", data.executive_id).eq("project_id", projectId);
      await supabase.from("sales_targets").insert(payload);
    }
    const execName = execNameMap.get(data.executive_id) || "";
    addLog({ actionType: "Sales Target Updated", userName: profile?.full_name || "Admin", role: "admin", entity: execName });
    toast({ title: "Target Saved", description: `Target updated for ${execName}.` });
    fetchData();
  };

  // ========== ENTRY ACTIONS ==========
  const handleAddManual = async (data: { executive_id: string; amount: number; order_invoice: string; payment_note: string }) => {
    await supabase.from("commission_entries").insert({
      executive_id: data.executive_id,
      project_id: projectId,
      amount: data.amount,
      order_invoice: data.order_invoice,
      payment_note: data.payment_note,
      source: "manual",
      status: "pending",
    });
    const name = execNameMap.get(data.executive_id) || "";
    addLog({ actionType: "Manual Commission Added", userName: profile?.full_name || "Admin", role: "admin", entity: name, details: `৳${data.amount}` });
    toast({ title: "Added", description: `Manual commission ৳${data.amount} added for ${name}.` });
    fetchData();
  };

  const handleMarkPaid = async () => {
    if (!payingEntry) return;
    await supabase.from("commission_entries").update({
      status: "paid",
      paid_date: new Date().toISOString().slice(0, 10),
      payment_note: paymentNote,
      paid_by: user?.id || null,
    }).eq("id", payingEntry.id);
    const name = execNameMap.get(payingEntry.executive_id) || "";
    addLog({ actionType: "Commission Marked Paid", userName: profile?.full_name || "Admin", role: "admin", entity: `${name} — ${payingEntry.order_invoice || payingEntry.id.slice(0, 8)}`, details: `৳${payingEntry.amount}` });
    toast({ title: "Paid", description: `৳${payingEntry.amount} marked as paid.` });
    setPayDialogOpen(false);
    setPayingEntry(null);
    setPaymentNote("");
    fetchData();
  };

  const handleCancelEntry = async (entry: CommissionEntry) => {
    await supabase.from("commission_entries").update({ status: "cancelled" }).eq("id", entry.id);
    toast({ title: "Cancelled", description: "Commission entry cancelled." });
    fetchData();
  };

  const handleBulkPaid = async () => {
    if (selectedEntries.size === 0) return;
    const ids = Array.from(selectedEntries);
    for (const id of ids) {
      await supabase.from("commission_entries").update({
        status: "paid", paid_date: new Date().toISOString().slice(0, 10), paid_by: user?.id || null,
      }).eq("id", id);
    }
    toast({ title: "Bulk Paid", description: `${ids.length} entries marked as paid.` });
    setSelectedEntries(new Set());
    fetchData();
  };

  // ========== AUTO-GENERATE ==========
  useEffect(() => {
    if (!projectId || !isAdmin || configs.length === 0 || orders.length === 0) return;

    const generateEntries = async () => {
      const existingOrderIds = new Set(entries.filter((e) => e.order_id).map((e) => e.order_id));
      const newEntries: any[] = [];

      for (const config of configs) {
        if (!config.enabled || !config.auto_generate) continue;

        const execOrders = orders.filter((o) => {
          if (o.assigned_to !== config.executive_id) return false;
          if (Number(o.price || 0) < config.min_order_value) return false;
          if (config.apply_on === "repeat_orders") return o.is_repeat && o.parent_order_id;
          if (config.apply_on === "upsell_orders") return o.is_upsell;
          return true; // all_orders
        });

        for (const order of execOrders) {
          if (existingOrderIds.has(order.id)) continue;
          let amount = config.type === "percentage"
            ? Math.round(Number(order.price || 0) * (config.rate / 100))
            : config.rate;
          if (config.max_commission_cap && amount > config.max_commission_cap) {
            amount = config.max_commission_cap;
          }
          if (amount <= 0) continue;
          newEntries.push({
            executive_id: config.executive_id,
            project_id: projectId,
            order_id: order.id,
            order_invoice: order.invoice_id || order.generated_order_id || "",
            amount,
            source: "auto",
            status: "pending",
          });
        }
      }

      if (newEntries.length > 0) {
        await supabase.from("commission_entries").insert(newEntries);
        fetchData();
      }
    };

    generateEntries();
    // Only run when configs/orders change, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs.length, orders.length, projectId]);

  // ========== DERIVED DATA ==========
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (e.status === "cancelled" && statusFilter !== "cancelled" && statusFilter !== "all") return false;
      if (selectedExec !== "all" && e.executive_id !== selectedExec) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      const entryDate = e.created_at?.slice(0, 10) || "";
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      return true;
    });
  }, [entries, selectedExec, dateFrom, dateTo, statusFilter]);

  const totalEarned = filteredEntries.filter((e) => e.status !== "cancelled").reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid = filteredEntries.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.amount), 0);
  const totalPending = filteredEntries.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);

  const getExecActuals = useCallback((execId: string) => {
    const seOrders = orders.filter((o) => o.assigned_to === execId);
    const repeatOrders = seOrders.filter((o) => o.is_repeat && o.parent_order_id).length;
    const upsellOrders = seOrders.filter((o) => o.is_upsell).length;
    const revenue = seOrders.reduce((s, o) => s + Number(o.price || 0), 0);
    const completedFollowups = followups.filter((f) => seOrders.some((o) => o.id === f.order_id)).length;
    const totalOrders = seOrders.length;
    return { totalOrders, repeatOrders, upsellOrders, revenue, completedFollowups };
  }, [orders, followups]);

  const pendingCount = selectedEntries.size;

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">Access restricted to Admin only.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Targets & Commission" description="Full commission engine with per-executive config, targets, and ledger" />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* ========== KPI CARDS ========== */}
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

          {/* ========== PER-EXECUTIVE CONFIG + TARGETS ========== */}
          <div className="mb-6 animate-fade-in">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" /> Executive Commission & Targets
            </h2>
            {executives.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 card-shadow text-center text-muted-foreground">
                No sales executives found.
              </div>
            ) : (
              <div className="space-y-3">
                {executives.map((exec) => {
                  const config = getConfig(exec.userId);
                  const target = getTarget(exec.userId);
                  const actuals = getExecActuals(exec.userId);
                  const execEntries = entries.filter((e) => e.executive_id === exec.userId && e.status !== "cancelled");
                  const execEarned = execEntries.reduce((s, e) => s + Number(e.amount), 0);
                  const execPaid = execEntries.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.amount), 0);

                  return (
                    <Collapsible key={exec.userId}>
                      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {exec.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-medium text-foreground text-sm">{exec.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {config?.enabled ? (
                                    <span>Commission: {config.type === "percentage" ? `${config.rate}%` : `৳${config.rate}/order`} on {config.apply_on.replace("_", " ")}</span>
                                  ) : "Commission disabled"}
                                  {" · "}Earned ৳{execEarned.toLocaleString()} · Paid ৳{execPaid.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={config?.enabled ?? false}
                                onCheckedChange={(e) => { e.preventDefault?.(); quickToggleCommission(exec.userId); }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t border-border p-4 space-y-4">
                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => {
                                setEditingConfig({
                                  config: config || {
                                    executive_id: exec.userId, project_id: projectId, enabled: false,
                                    type: "percentage", rate: 5, apply_on: "repeat_orders",
                                    min_order_value: 0, max_commission_cap: null, auto_generate: true,
                                  },
                                  name: exec.name,
                                });
                                setConfigDialogOpen(true);
                              }}>
                                <Settings2 className="h-3.5 w-3.5 mr-1" /> Edit Commission Settings
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => {
                                setEditingTarget({
                                  target: target ? { ...target } as any : null,
                                  execId: exec.userId,
                                  name: exec.name,
                                });
                                setTargetDialogOpen(true);
                              }}>
                                <Target className="h-3.5 w-3.5 mr-1" /> {target ? "Edit Target" : "Set Target"}
                              </Button>
                            </div>

                            {/* Commission config summary */}
                            {config?.enabled && (
                              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
                                <p><span className="text-muted-foreground">Type:</span> <span className="font-medium text-foreground">{config.type === "percentage" ? `${config.rate}%` : `৳${config.rate} fixed`}</span></p>
                                <p><span className="text-muted-foreground">Apply On:</span> <span className="font-medium text-foreground">{config.apply_on.replace(/_/g, " ")}</span></p>
                                <p><span className="text-muted-foreground">Min Order:</span> <span className="font-medium text-foreground">৳{config.min_order_value}</span></p>
                                {config.max_commission_cap && <p><span className="text-muted-foreground">Max Cap:</span> <span className="font-medium text-foreground">৳{config.max_commission_cap}</span></p>}
                                <p><span className="text-muted-foreground">Auto-Generate:</span> <span className="font-medium text-foreground">{config.auto_generate ? "Yes" : "No"}</span></p>
                              </div>
                            )}

                            {/* Target progress */}
                            {target ? (
                              <div className="space-y-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Target: {target.period_type} ({target.start_date} → {target.end_date})
                                </p>
                                {[
                                  { label: "Orders", actual: actuals.totalOrders, goal: target.target_orders },
                                  { label: "Repeat Orders", actual: actuals.repeatOrders, goal: target.target_repeat_orders },
                                  { label: "Revenue", actual: actuals.revenue, goal: Number(target.target_revenue), prefix: "৳" },
                                  { label: "Upsell Count", actual: actuals.upsellOrders, goal: target.target_upsell_count },
                                  { label: "Followups", actual: actuals.completedFollowups, goal: target.target_followups },
                                ].filter((m) => m.goal > 0).map((m) => {
                                  const pct = Math.min(100, m.goal > 0 ? (m.actual / m.goal) * 100 : 0);
                                  const status = pct >= 100 ? "Exceeded" : pct >= 60 ? "On Track" : "Behind";
                                  return (
                                    <div key={m.label}>
                                      <div className="flex justify-between text-xs mb-1">
                                        <span className="text-muted-foreground">{m.label}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-foreground">
                                            {m.prefix || ""}{m.actual.toLocaleString()}/{m.prefix || ""}{m.goal.toLocaleString()}
                                          </span>
                                          <Badge variant={status === "Exceeded" ? "default" : status === "On Track" ? "secondary" : "destructive"} className="text-[10px] px-1.5 py-0">
                                            {status}
                                          </Badge>
                                        </div>
                                      </div>
                                      <Progress value={pct} className="h-2" />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No target set. Click "Set Target" to create one.</p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========== COMMISSION LEDGER ========== */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Commission Ledger
            </h2>
            <div className="flex gap-2">
              {pendingCount > 0 && (
                <Button size="sm" variant="outline" onClick={handleBulkPaid}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark {pendingCount} Paid
                </Button>
              )}
              <Button size="sm" onClick={() => setManualDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Manual Entry
              </Button>
            </div>
          </div>

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
                  {executives.map((se) => (
                    <SelectItem key={se.userId} value={se.userId}>{se.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={filteredEntries.filter((e) => e.status === "pending").length > 0 && filteredEntries.filter((e) => e.status === "pending").every((e) => selectedEntries.has(e.id))}
                      onChange={(e) => {
                        const pendingIds = filteredEntries.filter((en) => en.status === "pending").map((en) => en.id);
                        setSelectedEntries(e.target.checked ? new Set(pendingIds) : new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead>Executive</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {entry.status === "pending" && (
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedEntries.has(entry.id)}
                          onChange={(e) => {
                            const next = new Set(selectedEntries);
                            e.target.checked ? next.add(entry.id) : next.delete(entry.id);
                            setSelectedEntries(next);
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{execNameMap.get(entry.executive_id) || "Unknown"}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.order_invoice || "Manual"}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.created_at?.slice(0, 10)}</TableCell>
                    <TableCell className="text-right font-semibold">৳{Number(entry.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{entry.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.status === "paid" ? "default" : entry.status === "cancelled" ? "destructive" : "secondary"}
                        className="text-[11px]"
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-32 truncate">{entry.payment_note || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {entry.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                              setPayingEntry(entry);
                              setPaymentNote("");
                              setPayDialogOpen(true);
                            }}>
                              Mark Paid
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleCancelEntry(entry)}>
                              <Ban className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">No commission entries found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary row */}
          {filteredEntries.length > 0 && (
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span>Total: <span className="font-semibold text-foreground">৳{totalEarned.toLocaleString()}</span></span>
              <span>Paid: <span className="font-semibold text-success">৳{totalPaid.toLocaleString()}</span></span>
              <span>Pending: <span className="font-semibold" style={{ color: "hsl(var(--warning))" }}>৳{totalPending.toLocaleString()}</span></span>
            </div>
          )}
        </>
      )}

      {/* ========== DIALOGS ========== */}
      <CommissionConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        config={editingConfig?.config || null}
        executiveName={editingConfig?.name || ""}
        onSave={handleSaveConfig}
      />

      <SalesTargetDialog
        open={targetDialogOpen}
        onOpenChange={setTargetDialogOpen}
        target={editingTarget?.target ? editingTarget.target : editingTarget ? {
          executive_id: editingTarget.execId,
          project_id: projectId,
          period_type: "monthly",
          start_date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`,
          end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
          target_orders: 0,
          target_repeat_orders: 0,
          target_revenue: 0,
          target_upsell_count: 0,
          target_followups: 0,
          is_active: true,
        } : null}
        executiveName={editingTarget?.name || ""}
        onSave={handleSaveTarget}
      />

      <AddManualCommissionDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        executives={executives}
        onSave={handleAddManual}
      />

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
                  <span className="font-medium">{execNameMap.get(payingEntry.executive_id) || "Unknown"}</span>
                  {" — "}{payingEntry.order_invoice || "Manual entry"}
                </p>
                <p className="text-lg font-bold text-foreground mt-1">৳{Number(payingEntry.amount).toLocaleString()}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Note (optional)</Label>
                <Textarea value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g., Bank transfer, Cash..." className="resize-none" rows={2} />
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
