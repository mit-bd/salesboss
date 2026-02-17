import { useMemo, useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

export default function SalesExecutiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [execName, setExecName] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    // Get profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", id)
      .maybeSingle();

    setExecName(profile?.full_name || "Unknown");

    // Get orders
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .eq("assigned_to", id)
      .eq("is_deleted", false);

    setOrders(ordersData || []);

    const orderIds = (ordersData || []).map((o) => o.id);
    if (orderIds.length > 0) {
      const { data: fData } = await supabase
        .from("followup_history")
        .select("*")
        .in("order_id", orderIds);
      setFollowups(fData || []);
    } else {
      setFollowups([]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (dateFrom && o.order_date < dateFrom) return false;
      if (dateTo && o.order_date > dateTo) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo]);

  const filteredOrderIds = new Set(filtered.map((o) => o.id));
  const filteredFollowups = followups.filter((f) => filteredOrderIds.has(f.order_id));

  const repeatOrders = filtered.filter((o) => o.is_repeat && o.parent_order_id);
  const upsellOrders = filtered.filter((o) => o.is_upsell);
  const completedFollowups = filteredFollowups.length;
  const pendingFollowups = filtered.filter((o) => o.current_status === "pending").length;
  const revenue = filtered.reduce((sum, o) => sum + Number(o.price || 0), 0);

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

  const kpis = [
    { label: "Revenue", value: `৳${revenue.toLocaleString()}` },
    { label: "Orders", value: filtered.length },
    { label: "Followups Done", value: completedFollowups },
    { label: "Pending", value: pendingFollowups },
    { label: "Repeat Orders", value: repeatOrders.length },
    { label: "Upsell Orders", value: upsellOrders.length },
  ];

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
          <Link to="/sales-executives" className="text-primary underline">
            Back
          </Link>
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-4">
        <Link
          to="/sales-executives"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-fast"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Executives
        </Link>
      </div>

      <PageHeader title={execName} />

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

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4 card-shadow text-center">
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-lg font-bold text-card-foreground">{k.value}</p>
          </div>
        ))}
      </div>

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
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`৳${v.toLocaleString()}`, "Revenue"]}
                />
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

      {/* Tabs */}
      <Tabs defaultValue="all" className="animate-fade-in">
        <TabsList>
          <TabsTrigger value="all">All Orders ({filtered.length})</TabsTrigger>
          <TabsTrigger value="repeat">Repeat ({repeatOrders.length})</TabsTrigger>
          <TabsTrigger value="upsell">Upsell ({upsellOrders.length})</TabsTrigger>
        </TabsList>

        {(["all", "repeat", "upsell"] as const).map((tab) => {
          const list = tab === "repeat" ? repeatOrders : tab === "upsell" ? upsellOrders : filtered;
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
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((o) => (
                      <TableRow key={o.id}>
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
                        <TableCell className="text-right font-semibold">
                          ৳{Number(o.price || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {list.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                          No orders in this range.
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
