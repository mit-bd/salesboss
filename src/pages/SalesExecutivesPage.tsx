import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { mockOrders, mockSalesExecutives } from "@/data/mockData";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users } from "lucide-react";

export default function SalesExecutivesPage() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedExec, setSelectedExec] = useState("all");

  const metrics = useMemo(() => {
    return mockSalesExecutives
      .filter((se) => selectedExec === "all" || se.id === selectedExec)
      .map((se) => {
        const orders = mockOrders.filter((o) => {
          if (o.assignedTo !== se.id) return false;
          if (dateFrom && o.orderDate < dateFrom) return false;
          if (dateTo && o.orderDate > dateTo) return false;
          return true;
        });

        const totalOrders = orders.length;
        const repeatOrders = orders.filter((o) => o.isRepeat && o.parentOrderId).length;
        const upsellOrders = orders.filter((o) => o.isRepeat && !o.parentOrderId).length;
        const completedFollowups = orders.reduce(
          (sum, o) => sum + Math.max(0, o.followupStep - 1),
          0
        );
        const pendingFollowups = orders.filter((o) => o.followupStep <= 5).length;
        const revenue = orders.reduce((sum, o) => sum + o.price, 0);
        const conversionRate =
          completedFollowups > 0
            ? ((repeatOrders / completedFollowups) * 100).toFixed(1)
            : "0.0";

        return {
          ...se,
          totalOrders,
          repeatOrders,
          upsellOrders,
          completedFollowups,
          pendingFollowups,
          revenue,
          conversionRate,
        };
      });
  }, [dateFrom, dateTo, selectedExec]);

  return (
    <AppLayout>
      <PageHeader
        title="Sales Executives"
        description="Performance overview and tracking"
      >
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {metrics.length} executive{metrics.length !== 1 ? "s" : ""}
          </span>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 card-shadow animate-fade-in">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-40 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-40 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Executive</label>
          <Select value={selectedExec} onValueChange={setSelectedExec}>
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Executives</SelectItem>
              {mockSalesExecutives.map((se) => (
                <SelectItem key={se.id} value={se.id}>
                  {se.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI summary */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
        {[
          {
            label: "Total Revenue",
            value: `৳${metrics.reduce((s, m) => s + m.revenue, 0).toLocaleString()}`,
            icon: <TrendingUp className="h-4 w-4" />,
            color: "hsl(var(--kpi-revenue))",
          },
          {
            label: "Followups Done",
            value: metrics.reduce((s, m) => s + m.completedFollowups, 0),
            icon: <BarChart3 className="h-4 w-4" />,
            color: "hsl(var(--kpi-followup))",
          },
          {
            label: "Repeat Orders",
            value: metrics.reduce((s, m) => s + m.repeatOrders, 0),
            icon: <TrendingUp className="h-4 w-4" />,
            color: "hsl(var(--kpi-repeat))",
          },
          {
            label: "Pending Followups",
            value: metrics.reduce((s, m) => s + m.pendingFollowups, 0),
            icon: <BarChart3 className="h-4 w-4" />,
            color: "hsl(var(--kpi-orders))",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-4 card-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-xl font-bold text-card-foreground">{kpi.value}</p>
              </div>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}
              >
                {kpi.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Assigned</TableHead>
              <TableHead className="text-right">Followups Done</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead className="text-right">Repeat</TableHead>
              <TableHead className="text-right">Upsell</TableHead>
              <TableHead className="text-right">Conv. Rate</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m) => (
              <TableRow
                key={m.id}
                className="cursor-pointer"
                onClick={() => navigate(`/sales-executives/${m.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {m.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{m.totalOrders}</TableCell>
                <TableCell className="text-right font-medium text-success">
                  {m.completedFollowups}
                </TableCell>
                <TableCell className="text-right font-medium text-warning">
                  {m.pendingFollowups}
                </TableCell>
                <TableCell className="text-right font-medium">{m.repeatOrders}</TableCell>
                <TableCell className="text-right font-medium">{m.upsellOrders}</TableCell>
                <TableCell className="text-right font-medium">{m.conversionRate}%</TableCell>
                <TableCell className="text-right font-semibold">
                  ৳{m.revenue.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {metrics.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No executives found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
