import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Building2, Users, Clock, CheckCircle, XCircle, ShoppingCart,
  AlertTriangle, RefreshCw, Repeat, ClipboardList,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from "recharts";
import OwnerLayout from "@/components/owner/OwnerLayout";

interface Stats {
  totalProjects: number;
  activeProjects: number;
  expiringProjects: number;
  suspendedProjects: number;
  pendingRequests: number;
  totalUsers: number;
  totalOrders: number;
  totalFollowups: number;
  totalRepeatOrders: number;
  chartData: { month: string; orders: number; projects: number; users: number }[];
  topProjects: { name: string; orders: number }[];
  alerts: {
    expiring: { id: string; name: string; expiryDate: string }[];
    suspended: { id: string; name: string }[];
  };
}

export default function OwnerDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("manage-team", {
          body: { action: "dashboard_stats" },
        });
        if (!error && data) setStats(data);
      } catch (err) {
        console.error("[OwnerDashboard] Stats fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Total Projects", value: stats?.totalProjects ?? 0, icon: Building2, color: "text-primary" },
    { label: "Active Projects", value: stats?.activeProjects ?? 0, icon: CheckCircle, color: "text-green-500" },
    { label: "Expiring Soon", value: stats?.expiringProjects ?? 0, icon: AlertTriangle, color: "text-yellow-500" },
    { label: "Suspended", value: stats?.suspendedProjects ?? 0, icon: XCircle, color: "text-destructive" },
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-500" },
    { label: "Total Orders", value: stats?.totalOrders ?? 0, icon: ShoppingCart, color: "text-primary" },
    { label: "Total Followups", value: stats?.totalFollowups ?? 0, icon: ClipboardList, color: "text-orange-500" },
    { label: "Repeat Orders", value: stats?.totalRepeatOrders ?? 0, icon: Repeat, color: "text-purple-500" },
    { label: "Pending Requests", value: stats?.pendingRequests ?? 0, icon: Clock, color: "text-orange-500" },
  ];

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
  };

  const hasAlerts = stats && ((stats.alerts?.expiring?.length || 0) > 0 || (stats.alerts?.suspended?.length || 0) > 0);

  return (
    <OwnerLayout title="Owner Dashboard" subtitle="Platform management overview" pendingCount={stats?.pendingRequests}>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            {statCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{card.label}</p>
                    <card.icon className={`h-3.5 w-3.5 ${card.color} shrink-0`} />
                  </div>
                  <p className="text-xl font-bold text-foreground">{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Alerts Section */}
          {hasAlerts && (
            <div className="grid gap-4 lg:grid-cols-2">
              {(stats?.alerts?.expiring?.length || 0) > 0 && (
                <Card className="border-yellow-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Projects Expiring Soon
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats?.alerts.expiring.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{p.name}</span>
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">
                            Expires {new Date(p.expiryDate).toLocaleDateString()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {(stats?.alerts?.suspended?.length || 0) > 0 && (
                <Card className="border-destructive/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Suspended Projects
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats?.alerts.suspended.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{p.name}</span>
                          <Badge variant="destructive" className="text-xs">Suspended</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Charts Row 1 */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Orders Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.chartData || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Projects Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats?.chartData || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="projects" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.chartData || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="users" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Projects */}
          {(stats?.topProjects?.length || 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Performing Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.topProjects || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={120} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="orders" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </OwnerLayout>
  );
}
