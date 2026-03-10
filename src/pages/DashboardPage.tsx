import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader, { KpiCard } from "@/components/layout/PageHeader";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/contexts/AuthContext";
import { ShoppingCart, DollarSign, TrendingUp, RefreshCw, PhoneForwarded, Zap, Search, X, AlertTriangle, Bell, CalendarCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import GlobalFilters, { FilterState, EMPTY_FILTERS } from "@/components/GlobalFilters";
import { Input } from "@/components/ui/input";
import SubscriptionStatusCard from "@/components/SubscriptionStatusCard";

const STEP_LABELS = ["1st Followup", "2nd Followup", "3rd Followup", "4th Followup", "5th Followup"];
const PIE_COLORS = ["hsl(215, 80%, 52%)", "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)", "hsl(280, 60%, 55%)", "hsl(340, 65%, 52%)"];
const STEP_COLORS = ["hsl(215, 80%, 52%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(280, 60%, 55%)", "hsl(152, 60%, 42%)"];

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { activeOrders, followupHistory } = useOrderStore();
  const { members } = useTeamMembers();
  const { role } = useAuth();

  const today = new Date().toISOString().split("T")[0];
  const todayFollowups = activeOrders.filter(o => o.followupDate === today && (o.currentStatus || "pending") === "pending").length;
  const overdueFollowups = activeOrders.filter(o => o.followupDate && o.followupDate < today && (o.currentStatus || "pending") === "pending").length;
  const newAssignedToday = activeOrders.filter(o => o.createdAt && o.createdAt.startsWith(today) && o.assignedTo).length;

  const metrics = useMemo(() => {
    const total = activeOrders.length;
    const repeatOrders = activeOrders.filter(o => o.isRepeat);
    const repeatRate = total > 0 ? ((repeatOrders.length / total) * 100) : 0;
    const completedFollowups = followupHistory.length;
    const totalFollowupSlots = total * 5;
    const followupCompletion = totalFollowupSlots > 0 ? ((completedFollowups / totalFollowupSlots) * 100) : 0;
    const upsellOrders = activeOrders.filter(o => o.isUpsell);
    const upsellRate = total > 0 ? ((upsellOrders.length / total) * 100) : 0;
    const convertedOrders = activeOrders.filter(o => (o.currentStatus || "pending") === "completed");
    const conversionRate = total > 0 ? ((convertedOrders.length / total) * 100) : 0;
    const revenue = activeOrders.reduce((s, o) => s + o.price, 0);
    return { total, revenue, conversionRate, repeatRate, followupCompletion, upsellRate };
  }, [activeOrders, followupHistory]);

  const liveFollowupSteps = [1, 2, 3, 4, 5].map((step) => {
    const atStep = activeOrders.filter((o) => o.followupStep === step);
    return {
      step, label: STEP_LABELS[step - 1],
      pending: atStep.filter((o) => (o.currentStatus || "pending") === "pending").length,
      completed: atStep.filter((o) => (o.currentStatus || "pending") === "completed").length,
    };
  });
  const funnelData = liveFollowupSteps.map((s) => ({ name: s.label, pending: s.pending, completed: s.completed }));

  const sourceData = useMemo(() => {
    if (activeOrders.length === 0) return [];
    const counts: Record<string, number> = {};
    activeOrders.forEach(o => { const src = o.orderSource || "Unknown"; counts[src] = (counts[src] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, value: Math.round((count / activeOrders.length) * 100) }));
  }, [activeOrders]);

  const performanceData = useMemo(() => {
    if (members.length === 0) return [];
    return members
      .filter(m => m.role === "sales_executive" || m.role === "sub_admin")
      .map(m => {
        const assigned = activeOrders.filter(o => o.assignedTo === m.id);
        const completedFu = followupHistory.filter(h => h.completedBy === m.id);
        return { name: (m.name || m.email || "").split(" ")[0] || "User", orders: assigned.length, followups: completedFu.length };
      })
      .filter(d => d.orders > 0 || d.followups > 0);
  }, [members, activeOrders, followupHistory]);

  const searchResults = search.trim()
    ? activeOrders.filter((o) => o.customerName.toLowerCase().includes(search.toLowerCase()) || o.mobile.includes(search))
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

      {/* Subscription Status Card for Admin */}
      {role === "admin" && (
        <div className="mb-6">
          <SubscriptionStatusCard />
        </div>
      )}

      <div ref={searchRef} className="relative mb-6 max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by customer name or mobile..." value={search} onChange={(e) => { setSearch(e.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)} className="pl-9 pr-8" />
        {search && (
          <button onClick={() => { setSearch(""); setShowResults(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
            {searchResults.slice(0, 8).map((order) => (
              <div key={order.id} onClick={() => { navigate(`/orders/${order.id}`); setShowResults(false); setSearch(""); }} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-fast border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.mobile} · #{order.id}</p>
                </div>
                <span className="text-xs text-muted-foreground">৳{order.price}</span>
              </div>
            ))}
            {searchResults.length > 8 && <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-muted/30">+{searchResults.length - 8} more results</div>}
          </div>
        )}
        {showResults && search.trim() && searchResults.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card card-shadow p-4 text-center text-sm text-muted-foreground animate-fade-in">No orders found</div>
        )}
      </div>

      <GlobalFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <div className="cursor-pointer" onClick={() => navigate("/orders")}><KpiCard label="Total Orders" value={metrics.total} change={`${todayFollowups} due today`} changeType="neutral" icon={<ShoppingCart className="h-5 w-5" />} color="hsl(215,80%,52%)" /></div>
        <KpiCard label="Revenue" value={`৳${(metrics.revenue / 1000).toFixed(1)}K`} change="" changeType="neutral" icon={<DollarSign className="h-5 w-5" />} color="hsl(152,60%,42%)" />
        <KpiCard label="Conversion" value={`${metrics.conversionRate.toFixed(1)}%`} change="" changeType="neutral" icon={<TrendingUp className="h-5 w-5" />} color="hsl(280,60%,55%)" />
        <div className="cursor-pointer" onClick={() => navigate("/repeat-orders")}><KpiCard label="Repeat Rate" value={`${metrics.repeatRate.toFixed(1)}%`} change="" changeType="neutral" icon={<RefreshCw className="h-5 w-5" />} color="hsl(38,92%,50%)" /></div>
        <div className="cursor-pointer" onClick={() => navigate("/followups")}><KpiCard label="Followup Done" value={`${metrics.followupCompletion.toFixed(1)}%`} change={`${todayFollowups} due today`} changeType="neutral" icon={<PhoneForwarded className="h-5 w-5" />} color="hsl(199,89%,48%)" /></div>
        <KpiCard label="Upsell Rate" value={`${metrics.upsellRate.toFixed(1)}%`} change="" changeType="neutral" icon={<Zap className="h-5 w-5" />} color="hsl(340,65%,52%)" />
      </div>

      {(todayFollowups > 0 || overdueFollowups > 0 || newAssignedToday > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {todayFollowups > 0 && (
            <div onClick={() => navigate("/followups")} className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 cursor-pointer hover:bg-warning/10 transition-fast">
              <CalendarCheck className="h-5 w-5 text-warning shrink-0" />
              <div><p className="text-sm font-semibold text-foreground">{todayFollowups} Followups Due Today</p><p className="text-xs text-muted-foreground">Click to view pending followups</p></div>
            </div>
          )}
          {overdueFollowups > 0 && (
            <div onClick={() => navigate("/followups")} className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 cursor-pointer hover:bg-destructive/10 transition-fast">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div><p className="text-sm font-semibold text-foreground">{overdueFollowups} Overdue Followups</p><p className="text-xs text-muted-foreground">Followups past their due date</p></div>
            </div>
          )}
          {newAssignedToday > 0 && (
            <div onClick={() => navigate("/orders")} className="flex items-center gap-3 rounded-xl border border-info/30 bg-info/5 p-4 cursor-pointer hover:bg-info/10 transition-fast">
              <Bell className="h-5 w-5 text-info shrink-0" />
              <div><p className="text-sm font-semibold text-foreground">{newAssignedToday} Orders Assigned Today</p><p className="text-xs text-muted-foreground">New assignments created today</p></div>
            </div>
          )}
        </div>
      )}

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
          {sourceData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {sourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(214,20%,90%)', fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {sourceData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />{s.name} ({s.value}%)
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No order data yet</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Team Performance</h2>
          {performanceData.length > 0 ? (
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
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No team activity yet</div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Followup Step Overview</h2>
          <div className="space-y-3">
            {liveFollowupSteps.map((step, i) => {
              const total = step.pending + step.completed;
              const pct = total > 0 ? (step.completed / total) * 100 : 0;
              return (
                <div key={step.step} className="space-y-1.5 cursor-pointer hover:bg-muted/30 rounded-lg p-1.5 -mx-1.5 transition-fast" onClick={() => navigate("/followups")}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-card-foreground">{step.label}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{step.pending} pending</span><span>{step.completed} done</span></div>
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
