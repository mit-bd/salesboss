import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import AddTeamMemberDialog from "@/components/AddTeamMemberDialog";

interface Executive {
  userId: string;
  name: string;
  email: string;
}

export default function SalesExecutivesPage() {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedExec, setSelectedExec] = useState("all");
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/Delete state
  const [editMember, setEditMember] = useState<{ id: string; email: string; fullName: string; role: string | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Executive | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "sales_executive");

    const seUserIds = (roles || []).map((r) => r.user_id);

    if (seUserIds.length === 0) {
      setExecutives([]);
      setOrders([]);
      setFollowups([]);
      setLoading(false);
      return;
    }

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

    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .eq("is_deleted", false)
      .in("assigned_to", seUserIds);

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
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("se-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "followup_history" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: { action: "delete_user", userId: deleteTarget.userId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Deleted", description: `${deleteTarget.name} has been removed.` });
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const metrics = useMemo(() => {
    return executives
      .filter((se) => selectedExec === "all" || se.userId === selectedExec)
      .map((se) => {
        const seOrders = orders.filter((o) => {
          if (o.assigned_to !== se.userId) return false;
          if (dateFrom && o.order_date < dateFrom) return false;
          if (dateTo && o.order_date > dateTo) return false;
          return true;
        });

        const seOrderIds = new Set(seOrders.map((o) => o.id));
        const seFollowups = followups.filter((f) => seOrderIds.has(f.order_id));

        const totalOrders = seOrders.length;
        const repeatOrders = seOrders.filter((o) => o.is_repeat && o.parent_order_id).length;
        const upsellOrders = seOrders.filter((o) => o.is_upsell).length;
        const completedFollowups = seFollowups.length;
        const pendingFollowups = seOrders.filter((o) => o.current_status === "pending").length;
        const revenue = seOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);
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
  }, [executives, orders, followups, dateFrom, dateTo, selectedExec]);

  return (
    <AppLayout>
      <PageHeader
        title="Sales Executives"
        description="Performance overview and tracking"
      >
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {executives.length} executive{executives.length !== 1 ? "s" : ""}
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
              {executives.map((se) => (
                <SelectItem key={se.userId} value={se.userId}>
                  {se.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
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
                  {isAdmin && <TableHead className="text-right w-12">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((m) => (
                  <TableRow
                    key={m.userId}
                    className="cursor-pointer"
                    onClick={() => navigate(`/sales-executives/${m.userId}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {m.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <p className="font-medium text-foreground">{m.name}</p>
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
                    {isAdmin && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onClick={() =>
                                setEditMember({
                                  id: m.userId,
                                  email: m.email,
                                  fullName: m.name,
                                  role: "sales_executive",
                                })
                              }
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget({ userId: m.userId, name: m.name, email: m.email })}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {metrics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="h-24 text-center text-muted-foreground">
                      No sales executives found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Edit Dialog */}
      {editMember && (
        <AddTeamMemberDialog
          editMember={editMember}
          onClose={() => setEditMember(null)}
          onSuccess={() => fetchData()}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales Executive</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
              This will remove their account and unassign all their orders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
