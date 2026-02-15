import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader, { KpiCard } from "@/components/layout/PageHeader";
import { mockDashboardMetrics, mockFollowupSteps, mockSalesExecutives, mockOrders } from "@/data/mockData";
import { ShoppingCart, DollarSign, TrendingUp, RefreshCw, PhoneForwarded, Zap, Search, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import { Input } from "@/components/ui/input";

const m = mockDashboardMetrics;

const funnelData = mockFollowupSteps.map((s) => ({ name: s.label, pending: s.pending, completed: s.completed }));
const performanceData = mockSalesExecutives.map((se) => ({ name: se.name.split(" ")[0], orders: se.assignedOrders, followups: se.completedFollowups }));
const sourceData = [
  { name: "Website", value: 45 },
  { name: "Phone", value: 25 },
  { name: "Referral", value: 18 },
  { name: "Social", value: 12 },
];

const PIE_COLORS = ["hsl(215, 80%, 52%)", "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)", "hsl(280, 60%, 55%)"];
const STEP_COLORS = ["hsl(215, 80%, 52%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(280, 60%, 55%)", "hsl(152, 60%, 42%)"];

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const todayFollowups = mockOrders.filter(o => o.followupDate === "2026-02-15").length;

  const searchResults = search.trim()
    ? mockOrders.filter(
        (o) =>
          o.customerName.toLowerCase().includes(search.toLowerCase()) ||
          o.mobile.includes(search)
      )
    : [];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Sales overview and followup performance" />

      {/* Global Search */}
      <div ref={searchRef} className="relative mb-6 max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer name or mobile..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          className="pl-9 pr-8"
        />
        {search && (
          <button onClick={() => { setSearch(""); setShowResults(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
            {searchResults.slice(0, 8).map((order) => (
              <div
                key={order.id}
                onClick={() => { navigate(`/orders/${order.id}`); setShowResults(false); setSearch(""); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-fast border-b border-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.mobile} · #{order.id}</p>
                </div>
                <span className="text-xs text-muted-foreground">৳{order.price}</span>
              </div>
            ))}
            {searchResults.length > 8 && (
              <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-muted/30">
                +{searchResults.length - 8} more results
              </div>
            )}
          </div>
        )}
        {showResults && search.trim() && searchResults.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card card-shadow p-4 text-center text-sm text-muted-foreground animate-fade-in">
            No orders found
          </div>
        )}
      </div>

      <GlobalFilters filters={filters} onChange={setFilters} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <div className="cursor-pointer" onClick={() => navigate("/orders")}>
          <KpiCard label="Total Orders" value={m.totalOrders} change="+12 this week" changeType="positive" icon={<ShoppingCart className="h-5 w-5" />} color="hsl(215,80%,52%)" />
        </div>
        <KpiCard label="Revenue" value={`৳${(m.revenue / 1000).toFixed(1)}K`} change="+8.2% vs last month" changeType="positive" icon={<DollarSign className="h-5 w-5" />} color="hsl(152,60%,42%)" />
        <KpiCard label="Conversion" value={`${m.conversionRate}%`} change="+2.1%" changeType="positive" icon={<TrendingUp className="h-5 w-5" />} color="hsl(280,60%,55%)" />
        <div className="cursor-pointer" onClick={() => navigate("/repeat-orders")}>
          <KpiCard label="Repeat Rate" value={`${m.repeatOrderRate}%`} change="+4.5%" changeType="positive" icon={<RefreshCw className="h-5 w-5" />} color="hsl(38,92%,50%)" />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/followups")}>
          <KpiCard label="Followup Done" value={`${m.followupCompletion}%`} change={`${todayFollowups} due today`} changeType="neutral" icon={<PhoneForwarded className="h-5 w-5" />} color="hsl(199,89%,48%)" />
        </div>
        <KpiCard label="Upsell Rate" value={`${m.upsellSuccessRate}%`} change="+1.8%" changeType="positive" icon={<Zap className="h-5 w-5" />} color="hsl(340,65%,52%)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Followup Pipeline</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(215,12%,52%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(215,12%,52%)" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(214,20%,90%)', fontSize: 13 }} />
              <Bar dataKey="completed" name="Completed" fill="hsl(152,60%,42%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" name="Pending" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Order Sources</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                {sourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(214,20%,90%)', fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {sourceData.map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                {s.name} ({s.value}%)
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Team Performance</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={performanceData} layout="vertical" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(215,12%,52%)" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="hsl(215,12%,52%)" width={60} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(214,20%,90%)', fontSize: 13 }} />
              <Bar dataKey="orders" name="Orders" fill="hsl(215,80%,52%)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="followups" name="Followups" fill="hsl(199,89%,48%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Followup Step Overview</h2>
          <div className="space-y-3">
            {mockFollowupSteps.map((step, i) => {
              const total = step.pending + step.completed;
              const pct = total > 0 ? (step.completed / total) * 100 : 0;
              return (
                <div key={step.step} className="space-y-1.5 cursor-pointer hover:bg-muted/30 rounded-lg p-1.5 -mx-1.5 transition-fast" onClick={() => navigate("/followups")}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-card-foreground">{step.label}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{step.pending} pending</span>
                      <span>{step.completed} done</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: STEP_COLORS[i] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
