import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useRole } from "@/contexts/RoleContext";
import { useAuditLog } from "@/contexts/AuditLogContext";
import { mockSalesExecutives, mockCommissionConfigs, mockCommissionEntries, mockOrders, mockSalesTargets } from "@/data/mockData";
import { CommissionConfig, CommissionEntry } from "@/types/data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Target, DollarSign, TrendingUp, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CommissionPage() {
  const { isAdmin } = useRole();
  const { addLog } = useAuditLog();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<CommissionConfig[]>(mockCommissionConfigs);
  const [entries, setEntries] = useState<CommissionEntry[]>(mockCommissionEntries);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedExec, setSelectedExec] = useState("all");
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingEntry, setPayingEntry] = useState<CommissionEntry | null>(null);
  const [paymentNote, setPaymentNote] = useState("");

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedExec !== "all" && e.executiveId !== selectedExec) return false;
      if (dateFrom && e.orderDate < dateFrom) return false;
      if (dateTo && e.orderDate > dateTo) return false;
      return true;
    });
  }, [entries, selectedExec, dateFrom, dateTo]);

  const totalEarned = filteredEntries.reduce((s, e) => s + e.amount, 0);
  const totalPaid = filteredEntries.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const totalPending = totalEarned - totalPaid;

  const targetProgress = useMemo(() => {
    return mockSalesExecutives.map((se) => {
      const target = mockSalesTargets.find((t) => t.executiveId === se.id);
      const config = configs.find((c) => c.executiveId === se.id);
      const seOrders = mockOrders.filter((o) => o.assignedTo === se.id);
      const repeatOrders = seOrders.filter((o) => o.isRepeat && o.parentOrderId).length;
      const upsellOrders = seOrders.filter((o) => o.isUpsell).length;
      const revenue = seOrders.reduce((s, o) => s + o.price, 0);

      return {
        exec: se,
        config,
        target,
        repeatOrders,
        upsellOrders,
        revenue,
        repeatPct: target ? Math.min(100, (repeatOrders / target.targetRepeatOrders) * 100) : 0,
        revenuePct: target ? Math.min(100, (revenue / target.targetRevenue) * 100) : 0,
        upsellPct: target ? Math.min(100, (upsellOrders / target.targetUpsellCount) * 100) : 0,
      };
    });
  }, [configs]);

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Access restricted to Admin only.
        </div>
      </AppLayout>
    );
  }

  const toggleCommission = (execId: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.executiveId === execId ? { ...c, enabled: !c.enabled } : c))
    );
    const exec = mockSalesExecutives.find((se) => se.id === execId);
    const config = configs.find((c) => c.executiveId === execId);
    addLog({
      actionType: config?.enabled ? "Commission Disabled" : "Commission Enabled",
      userName: "Admin User",
      role: "admin",
      entity: exec?.name || execId,
    });
    toast({ title: "Updated", description: `Commission ${config?.enabled ? "disabled" : "enabled"} for ${exec?.name}.` });
  };

  const handleMarkPaid = () => {
    if (!payingEntry) return;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === payingEntry.id
          ? { ...e, status: "paid" as const, paidDate: new Date().toISOString().slice(0, 10), paymentNote }
          : e
      )
    );
    const exec = mockSalesExecutives.find((se) => se.id === payingEntry.executiveId);
    addLog({
      actionType: "Commission Marked Paid",
      userName: "Admin User",
      role: "admin",
      entity: `${exec?.name} - ${payingEntry.orderId}`,
      details: `৳${payingEntry.amount}${paymentNote ? ` — ${paymentNote}` : ""}`,
    });
    toast({ title: "Marked as Paid", description: `৳${payingEntry.amount} commission marked as paid.` });
    setPayDialogOpen(false);
    setPayingEntry(null);
    setPaymentNote("");
  };

  return (
    <AppLayout>
      <PageHeader title="Targets & Commission" description="Sales targets, commission tracking, and payouts" />

      {/* KPI summary */}
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

      {/* Target Progress */}
      <div className="mb-6 animate-fade-in">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Target className="h-4 w-4" /> Monthly Targets
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {targetProgress.map(({ exec, config, target, repeatOrders, upsellOrders, revenue, repeatPct, revenuePct, upsellPct }) => (
            <div key={exec.id} className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {exec.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{exec.name}</p>
                    <p className="text-xs text-muted-foreground">{exec.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Commission</span>
                  <Switch checked={config?.enabled ?? false} onCheckedChange={() => toggleCommission(exec.id)} />
                </div>
              </div>

              {target && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Repeat Orders</span>
                      <span className="font-medium text-foreground">{repeatOrders}/{target.targetRepeatOrders}</span>
                    </div>
                    <Progress value={repeatPct} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-medium text-foreground">৳{revenue.toLocaleString()}/৳{target.targetRevenue.toLocaleString()}</span>
                    </div>
                    <Progress value={revenuePct} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Upsell Count</span>
                      <span className="font-medium text-foreground">{upsellOrders}/{target.targetUpsellCount}</span>
                    </div>
                    <Progress value={upsellPct} className="h-2" />
                  </div>
                </div>
              )}

              {config?.enabled && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Commission: {config.type === "percentage" ? `${config.rate}% of repeat order revenue` : `৳${config.rate} per repeat order`}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Commission Entries */}
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <DollarSign className="h-4 w-4" /> Commission Ledger
      </h2>

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
              {mockSalesExecutives.filter((se) => configs.find((c) => c.executiveId === se.id)?.enabled).map((se) => (
                <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Entries table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Executive</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.map((entry) => {
              const exec = mockSalesExecutives.find((se) => se.id === entry.executiveId);
              return (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium text-foreground">{exec?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{entry.orderId}</TableCell>
                  <TableCell className="text-muted-foreground">{entry.orderDate}</TableCell>
                  <TableCell className="text-right font-semibold">৳{entry.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={entry.status === "paid" ? "default" : "secondary"} className="text-[11px]">
                      {entry.status === "paid" ? "Paid" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.paymentNote || "—"}</TableCell>
                  <TableCell className="text-right">
                    {entry.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setPayingEntry(entry);
                          setPaymentNote("");
                          setPayDialogOpen(true);
                        }}
                      >
                        Mark Paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredEntries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                  No commission entries found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
                  <span className="font-medium">{mockSalesExecutives.find((se) => se.id === payingEntry.executiveId)?.name}</span>
                  {" — "}Order {payingEntry.orderId}
                </p>
                <p className="text-lg font-bold text-foreground mt-1">৳{payingEntry.amount.toLocaleString()}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Note (optional)</Label>
                <Textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g., Bank transfer, Cash..."
                  className="resize-none"
                  rows={2}
                />
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
