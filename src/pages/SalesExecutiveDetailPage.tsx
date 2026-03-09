import { useMemo, useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Loader2, Package, DollarSign, CheckCircle2, Clock,
  AlertTriangle, CalendarCheck, Repeat, TrendingUp, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, isToday, isBefore, startOfDay } from "date-fns";

const STEP_LABELS = ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"];
const STEP_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function SalesExecutiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [execName, setExecName] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [commissionEntries, setCommissionEntries] = useState<any[]>([]);
  const [salesTargets, setSalesTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [profileRes, ordersRes, commRes, targetsRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", id).maybeSingle(),
      supabase.from("orders").select("*").eq("assigned_to", id).eq("is_deleted", false),
      supabase.from("commission_entries").select("*").eq("executive_id", id),
      supabase.from("sales_targets").select("*").eq("executive_id", id).eq("is_active", true),
    ]);

    setExecName(profileRes.data?.full_name || "Unknown");
    const allOrders = ordersRes.data || [];
    setOrders(allOrders);
    setCommissionEntries(commRes.data || []);
    setSalesTargets(targetsRes.data || []);

    const orderIds = allOrders.map((o: any) => o.id);
    if (orderIds.length > 0) {
      const { data: fData } = await supabase
        .from("followup_history").select("*").in("order_id", orderIds);
      setFollowups(fData || []);
    } else {
      setFollowups([]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Date-filtered orders
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (dateFrom && o.order_date < dateFrom) return false;
      if (dateTo && o.order_date > dateTo) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo]);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // Derived metrics
  const metrics = useMemo(() => {
    const filteredIds = new Set(filtered.map((o) => o.id));
    const filteredFollowups = followups.filter((f) => filteredIds.has(f.order_id));

    const pendingOrders = filtered.filter((o) => o.current_status === "pending");
    const overdueOrders = pendingOrders.filter(
      (o) => o.followup_date && isBefore(new Date(o.followup_date), startOfDay(new Date()))
    );
    const todayOrders = pendingOrders.filter(
      (o) => o.followup_date && o.followup_date === today
    );
    const repeatOrders = filtered.filter((o) => o.is_repeat && o.parent_order_id);
    const upsellOrders = filtered.filter((o) => o.is_upsell);
    const revenue = filtered.reduce((s, o) => s + Number(o.price || 0), 0);
    const totalCommission = commissionEntries
      .filter((c) => c.status !== "cancelled")
      .reduce((s, c) => s + Number(c.amount || 0), 0);

    // Step breakdown
    const stepBreakdown = [1, 2, 3, 4, 5].map((step) => {
      const atStep = filtered.filter((o) => o.followup_step === step);
      const pending = atStep.filter((o) => o.current_status === "pending").length;
      const completed = filteredFollowups.filter((f) => f.step_number === step).length;
      const overdue = atStep.filter(
        (o) => o.current_status === "pending" && o.followup_date && isBefore(new Date(o.followup_date), startOfDay(new Date()))
      ).length;
      return { step, pending, completed, overdue, total: atStep.length };
    });

    return {
      totalOrders: filtered.length,
      revenue,
      followupsCompleted: filteredFollowups.length,
      followupsRemaining: pendingOrders.length,
      overdueCount: overdueOrders.length,
      todayCount: todayOrders.length,
      repeatCount: repeatOrders.length,
      upsellCount: upsellOrders.length,
      totalCommission,
      pendingOrders,
      overdueOrders,
      todayOrders,
      repeatOrders,
      upsellOrders,
      stepBreakdown,
    };
  }, [filtered, followups, commissionEntries, today]);

  // Active target
  const activeTarget = useMemo(() => {
    return salesTargets.find((t) => t.start_date <= today && t.end_date >= today) || null;
  }, [salesTargets, today]);

  // Chart data
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; orders: number }> = {};
    filtered.forEach((o) => {
      const d = o.order_date;
      if (!map[d]) map[d] = { date: d, revenue: 0, orders: 0 };
      map[d].revenue += Number(o.price || 0);
      map[d].orders += 1;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!execName) {
    return (
      <AppLayout>
        <PageHeader title="Executive Not Found" />
        <p className="text-muted-foreground">
          No executive found.{" "}
          <Link to="/sales-executives" className="text-primary underline">Back</Link>
        </p>
      </AppLayout>
    );
  }

  const initials = execName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const kpis = [
    { label: "Total Orders", value: metrics.totalOrders, icon: <Package className="h-4 w-4" />, color: "hsl(var(--chart-1))" },
    { label: "Revenue", value: `৳${metrics.revenue.toLocaleString()}`, icon: <DollarSign className="h-4 w-4" />, color: "hsl(var(--chart-2))" },
    { label: "Followups Done", value: metrics.followupsCompleted, icon: <CheckCircle2 className="h-4 w-4" />, color: "hsl(var(--chart-3))" },
    { label: "Remaining", value: metrics.followupsRemaining, icon: <Clock className="h-4 w-4" />, color: "hsl(var(--chart-4))" },
    { label: "Overdue", value: metrics.overdueCount, icon: <AlertTriangle className="h-4 w-4" />, color: "hsl(var(--destructive))" },
    { label: "Today's Followups", value: metrics.todayCount, icon: <CalendarCheck className="h-4 w-4" />, color: "hsl(var(--chart-5))" },
    { label: "Repeat Orders", value: metrics.repeatCount, icon: <Repeat className="h-4 w-4" />, color: "hsl(var(--chart-1))" },
    { label: "Upsell Orders", value: metrics.upsellCount, icon: <TrendingUp className="h-4 w-4" />, color: "hsl(var(--chart-2))" },
  ];

  return (
    <AppLayout>
      {/* Back link */}
      <div className="mb-4">
        <Link to="/sales-executives" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Executives
        </Link>
      </div>

      {/* Profile Header */}
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{execName}</h1>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{metrics.totalOrders} orders</span>
            <span>৳{metrics.revenue.toLocaleString()} revenue</span>
            <span>৳{metrics.totalCommission.toLocaleString()} commission</span>
          </div>
        </div>
      </div>

      {/* Date filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 card-shadow animate-fade-in">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40 text-sm" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 animate-fade-in">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4 card-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-lg font-bold text-card-foreground">{k.value}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${k.color}20`, color: k.color }}>
                {k.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Followup Pipeline */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Followup Pipeline</h2>
        <div className="grid grid-cols-5 gap-2">
          {metrics.stepBreakdown.map((s, i) => {
            const total = s.pending + s.completed;
            const pct = total > 0 ? Math.round((s.completed / Math.max(total, 1)) * 100) : 0;
            return (
              <div key={s.step} className="rounded-lg border border-border p-3 text-center">
                <div className="mb-2 text-xs font-semibold" style={{ color: STEP_COLORS[i] }}>
                  {STEP_LABELS[i]}
                </div>
                <div className="text-lg font-bold text-card-foreground">{total}</div>
                <Progress value={pct} className="mt-2 h-1.5" />
                <div className="mt-2 flex justify-center gap-2 text-[10px]">
                  <span className="text-muted-foreground">{s.completed} done</span>
                  <span className="text-muted-foreground">{s.pending} pending</span>
                </div>
                {s.overdue > 0 && (
                  <Badge variant="destructive" className="mt-1 text-[10px] px-1.5 py-0">
                    {s.overdue} overdue
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Progress */}
      {activeTarget && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Active Target ({activeTarget.period_type}) — {activeTarget.start_date} to {activeTarget.end_date}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Orders", actual: metrics.totalOrders, target: activeTarget.target_orders },
              { label: "Revenue", actual: metrics.revenue, target: activeTarget.target_revenue, prefix: "৳" },
              { label: "Followups", actual: metrics.followupsCompleted, target: activeTarget.target_followups },
              { label: "Repeat", actual: metrics.repeatCount, target: activeTarget.target_repeat_orders },
              { label: "Upsell", actual: metrics.upsellCount, target: activeTarget.target_upsell_count },
            ].map((t) => {
              const pct = t.target > 0 ? Math.min(Math.round((t.actual / t.target) * 100), 100) : 0;
              const status = pct >= 100 ? "Exceeded" : pct >= 60 ? "On Track" : "Behind";
              return (
                <div key={t.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                  <p className="mt-1 text-sm font-bold text-card-foreground">
                    {t.prefix || ""}{t.actual.toLocaleString()} / {t.prefix || ""}{t.target.toLocaleString()}
                  </p>
                  <Progress value={pct} className="mt-2 h-1.5" />
                  <Badge
                    variant={status === "Behind" ? "destructive" : "secondary"}
                    className="mt-1 text-[10px] px-1.5 py-0"
                  >
                    {status} ({pct}%)
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alert Cards: Today + Overdue */}
      {(metrics.todayOrders.length > 0 || metrics.overdueOrders.length > 0) && (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
          {/* Today's Followups */}
          {metrics.todayOrders.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Today's Followups ({metrics.todayOrders.length})</h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {metrics.todayOrders.map((o: any) => (
                  <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors">
                    <div>
                      <span className="text-sm font-medium text-primary">{o.invoice_id}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{o.customer_name}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Step {o.followup_step}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Overdue Followups */}
          {metrics.overdueOrders.length > 0 && (
            <div className="rounded-xl border-2 border-destructive/30 bg-card p-5 card-shadow">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold text-destructive">Overdue Followups ({metrics.overdueOrders.length})</h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {[...metrics.overdueOrders]
                  .sort((a: any, b: any) => new Date(a.followup_date).getTime() - new Date(b.followup_date).getTime())
                  .map((o: any) => {
                    const daysOverdue = differenceInDays(new Date(), new Date(o.followup_date));
                    return (
                      <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between rounded-lg border border-destructive/20 p-2.5 hover:bg-destructive/5 transition-colors">
                        <div>
                          <span className="text-sm font-medium text-primary">{o.invoice_id}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{o.customer_name}</span>
                        </div>
                        <Badge variant="destructive" className="text-[10px]">{daysOverdue}d overdue</Badge>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
          <div className="rounded-xl border border-border bg-card p-5 card-shadow">
            <p className="mb-3 text-sm font-semibold text-foreground">Revenue Over Time</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`৳${v.toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 card-shadow">
            <p className="mb-3 text-sm font-semibold text-foreground">Orders Over Time</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="orders" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabbed Order Tables */}
      <Tabs defaultValue="all" className="animate-fade-in">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({metrics.followupsRemaining})</TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue ({metrics.overdueCount})
          </TabsTrigger>
          <TabsTrigger value="today">Today ({metrics.todayCount})</TabsTrigger>
          <TabsTrigger value="repeat">Repeat ({metrics.repeatCount})</TabsTrigger>
          <TabsTrigger value="upsell">Upsell ({metrics.upsellCount})</TabsTrigger>
        </TabsList>

        {(["all", "pending", "overdue", "today", "repeat", "upsell"] as const).map((tab) => {
          let list: any[];
          switch (tab) {
            case "pending": list = metrics.pendingOrders; break;
            case "overdue": list = [...metrics.overdueOrders].sort((a, b) => new Date(a.followup_date).getTime() - new Date(b.followup_date).getTime()); break;
            case "today": list = metrics.todayOrders; break;
            case "repeat": list = metrics.repeatOrders; break;
            case "upsell": list = metrics.upsellOrders; break;
            default: list = filtered;
          }

          return (
            <TabsContent key={tab} value={tab}>
              <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Followup Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((o: any) => {
                      const isOverdue = o.current_status === "pending" && o.followup_date && isBefore(new Date(o.followup_date), startOfDay(new Date()));
                      const isDueToday = o.followup_date === today;
                      return (
                        <TableRow key={o.id} className={isOverdue ? "bg-destructive/5" : ""}>
                          <TableCell>
                            <Link to={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                              {o.invoice_id}
                            </Link>
                          </TableCell>
                          <TableCell>{o.customer_name}</TableCell>
                          <TableCell className="text-muted-foreground">{o.product_title}</TableCell>
                          <TableCell className="text-muted-foreground">{o.order_date}</TableCell>
                          <TableCell>
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
                              Step {o.followup_step}
                            </span>
                          </TableCell>
                          <TableCell>
                            {o.current_status === "completed" ? (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-0">Completed</Badge>
                            ) : isOverdue ? (
                              <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                            ) : isDueToday ? (
                              <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-0">Due Today</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {o.followup_date || "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ৳{Number(o.price || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {list.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                          No orders found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </AppLayout>
  );
}
