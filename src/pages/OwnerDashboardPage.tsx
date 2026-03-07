import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Users, Clock, CheckCircle, LogOut, XCircle, ShoppingCart } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Link } from "react-router-dom";

interface Stats {
  totalProjects: number;
  activeProjects: number;
  suspendedProjects: number;
  pendingRequests: number;
  totalUsers: number;
  totalOrders: number;
}

export default function OwnerDashboardPage() {
  const { signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("manage-team", {
          body: { action: "dashboard_stats" },
        });
        if (error) {
          console.error("[OwnerDashboard] Stats error:", error);
        } else if (data) {
          setStats(data);
        }
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
    { label: "Suspended Projects", value: stats?.suspendedProjects ?? 0, icon: XCircle, color: "text-destructive" },
    { label: "Pending Requests", value: stats?.pendingRequests ?? 0, icon: Clock, color: "text-warning" },
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-info" },
    { label: "Total Orders", value: stats?.totalOrders ?? 0, icon: ShoppingCart, color: "text-primary" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Owner Dashboard</h1>
            <p className="text-sm text-muted-foreground">Platform management overview</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="flex gap-3">
          <Link to="/owner">
            <Button variant="default" size="sm">Dashboard</Button>
          </Link>
          <Link to="/owner/requests">
            <Button variant="outline" size="sm">
              Registration Requests
              {(stats?.pendingRequests ?? 0) > 0 && (
                <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                  {stats?.pendingRequests}
                </span>
              )}
            </Button>
          </Link>
          <Link to="/owner/projects">
            <Button variant="outline" size="sm">Projects</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <card.icon className={`h-8 w-8 ${card.color}`} />
                    <span className="text-3xl font-bold text-foreground">{card.value}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
