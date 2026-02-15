import AppLayout from "@/components/layout/AppLayout";
import PageHeader, { KpiCard } from "@/components/layout/PageHeader";
import { mockDashboardMetrics, mockFollowupSteps, mockSalesExecutives, mockOrders } from "@/data/mockData";
import { ShoppingCart, DollarSign, TrendingUp, RefreshCw, PhoneForwarded, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const m = mockDashboardMetrics;

const funnelData = mockFollowupSteps.map((s) => ({
  name: s.label,
  pending: s.pending,
  completed: s.completed,
}));

const performanceData = mockSalesExecutives.map((se) => ({
  name: se.name.split(" ")[0],
  orders: se.assignedOrders,
  followups: se.completedFollowups,
}));

const sourceData = [
  { name: "Website", value: 45 },
  { name: "Phone", value: 25 },
  { name: "Referral", value: 18 },
  { name: "Social", value: 12 },
];

const PIE_COLORS = [
  "hsl(215, 80%, 52%)",
  "hsl(152, 60%, 42%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
];

const STEP_COLORS = [
  "hsl(215, 80%, 52%)",
  "hsl(199, 89%, 48%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(152, 60%, 42%)",
];

export default function DashboardPage() {
  const todayFollowups = mockOrders.filter(o => o.followupDate === "2026-02-15").length;

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Sales overview and followup performance" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Total Orders" value={m.totalOrders} change="+12 this week" changeType="positive" icon={<ShoppingCart className="h-5 w-5" />} color="hsl(215,80%,52%)" />
        <KpiCard label="Revenue" value={`₹${(m.revenue / 1000).toFixed(1)}K`} change="+8.2% vs last month" changeType="positive" icon={<DollarSign className="h-5 w-5" />} color="hsl(152,60%,42%)" />
        <KpiCard label="Conversion" value={`${m.conversionRate}%`} change="+2.1%" changeType="positive" icon={<TrendingUp className="h-5 w-5" />} color="hsl(280,60%,55%)" />
        <KpiCard label="Repeat Rate" value={`${m.repeatOrderRate}%`} change="+4.5%" changeType="positive" icon={<RefreshCw className="h-5 w-5" />} color="hsl(38,92%,50%)" />
        <KpiCard label="Followup Done" value={`${m.followupCompletion}%`} change={`${todayFollowups} due today`} changeType="neutral" icon={<PhoneForwarded className="h-5 w-5" />} color="hsl(199,89%,48%)" />
        <KpiCard label="Upsell Rate" value={`${m.upsellSuccessRate}%`} change="+1.8%" changeType="positive" icon={<Zap className="h-5 w-5" />} color="hsl(340,65%,52%)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Followup Funnel */}
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

        {/* Order Sources */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Order Sources</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                {sourceData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
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
        {/* Team Performance */}
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

        {/* Step Counters */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Followup Step Overview</h2>
          <div className="space-y-3">
            {mockFollowupSteps.map((step, i) => {
              const total = step.pending + step.completed;
              const pct = total > 0 ? (step.completed / total) * 100 : 0;
              return (
                <div key={step.step} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-card-foreground">{step.label}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{step.pending} pending</span>
                      <span>{step.completed} done</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: STEP_COLORS[i] }}
                    />
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
