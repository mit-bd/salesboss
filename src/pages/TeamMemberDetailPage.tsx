import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Building2, IdCard, Loader2, Mail, Phone, ShieldCheck, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Member {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  employeeId: string | null;
  department: string | null;
  status: string;
  role: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  projectId: string | null;
  joinDate: string | null;
  lastSignIn: string | null;
  banned: boolean;
}

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "active") return "default";
  if (s === "on_hold") return "secondary";
  if (s === "suspended" || s === "resigned") return "destructive";
  return "outline";
};

const prettify = (s: string | null | undefined) =>
  (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function TeamMemberDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ totalOrders: number; pendingOrders: number; completedFollowups: number; assignedCustomers: number } | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activity, setActivity] = useState<{ orderActivity: any[]; hierarchy: any[]; followups: any[] } | null>(null);

  const initials = useMemo(() => {
    if (!member) return "";
    const src = member.fullName || member.email;
    return src.split(" ").map((n) => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
  }, [member]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [detail, statsRes] = await Promise.all([
        supabase.functions.invoke("manage-team", { body: { action: "get_member_detail", userId } }),
        supabase.functions.invoke("manage-team", { body: { action: "member_stats", userId } }),
      ]);
      if (detail.error || detail.data?.error) throw new Error(detail.data?.error || detail.error?.message);
      setMember(detail.data.member);
      if (statsRes.data?.stats) setStats(statsRes.data.stats);

      const [{ data: ords }, memberProfile] = await Promise.all([
        supabase.from("orders").select("id, customer_name, price, current_status, followup_step, order_date, delivery_status, invoice_id, generated_order_id").eq("assigned_to", userId).eq("is_deleted", false).order("order_date", { ascending: false }).limit(50),
        supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
      ]);
      setOrders(ords || []);
      const name = memberProfile.data?.full_name;
      if (name) {
        const { data: cust } = await supabase.from("customers").select("id, name, mobile_number, total_orders, lifetime_value, last_order_date").eq("last_executive_name", name).order("last_order_date", { ascending: false }).limit(50);
        setCustomers(cust || []);
      }

      const act = await supabase.functions.invoke("manage-team", { body: { action: "member_activity", userId, limit: 80 } });
      if (act.data?.activity) setActivity(act.data.activity);
    } catch (e: any) {
      toast({ title: "Failed to load member", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => { load(); }, [load]);

  if (loading || !member) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  const timeline = [
    ...(activity?.orderActivity || []).map((a) => ({ type: "order", ts: a.created_at, title: a.action_type, sub: a.action_description })),
    ...(activity?.hierarchy || []).map((h) => ({ type: "hier", ts: h.created_at, title: `Hierarchy ${h.change_type}`, sub: `${prettify(h.old_value) || "—"} → ${prettify(h.new_value) || "—"}${h.reason ? ` · ${h.reason}` : ""}` })),
    ...(activity?.followups || []).map((f) => ({ type: "followup", ts: f.completed_at, title: `Followup step ${f.step_number}`, sub: f.note?.slice(0, 120) || "" })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <AppLayout>
      <PageHeader title={member.fullName || member.email} description="Employee profile and performance">
        <Button asChild variant="outline" size="sm">
          <Link to="/team"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Team</Link>
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card card-shadow p-5 mb-4 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold overflow-hidden">
            {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">{member.fullName || "Unnamed"}</h2>
              <Badge variant={statusVariant(member.status)} className="text-xs">{prettify(member.status)}</Badge>
              {member.role && <Badge variant="outline" className="text-xs"><ShieldCheck className="mr-1 h-3 w-3" />{prettify(member.role)}</Badge>}
            </div>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5" />{member.employeeId || "—"}</div>
              <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{member.department || "—"}</div>
              <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{member.email}</div>
              <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{member.phone || "—"}</div>
              <div className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" />Supervisor: {member.supervisorName || "—"}</div>
              <div>Joined: {member.joinDate ? new Date(member.joinDate).toLocaleDateString() : "—"}</div>
              <div>Last login: {member.lastSignIn ? new Date(member.lastSignIn).toLocaleString() : "Never"}</div>
            </div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Assigned Orders", value: stats.totalOrders },
            { label: "Pending", value: stats.pendingOrders },
            { label: "Followups Done", value: stats.completedFollowups },
            { label: "Customers", value: stats.assignedCustomers },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Assigned Orders</TabsTrigger>
          <TabsTrigger value="customers">Assigned Customers</TabsTrigger>
          <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No assigned orders.</TableCell></TableRow>
                ) : orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell><Link className="text-primary hover:underline" to={`/orders/${o.id}`}>{o.generated_order_id || o.invoice_id || o.id.slice(0, 8)}</Link></TableCell>
                    <TableCell>{o.customer_name}</TableCell>
                    <TableCell>৳{Number(o.price || 0).toLocaleString()}</TableCell>
                    <TableCell>{o.followup_step ?? "—"}</TableCell>
                    <TableCell>{prettify(o.current_status)}</TableCell>
                    <TableCell>{prettify(o.delivery_status) || "—"}</TableCell>
                    <TableCell>{o.order_date ? new Date(o.order_date).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="mt-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Customer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Lifetime Value</TableHead>
                  <TableHead>Last Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No customers linked to this executive.</TableCell></TableRow>
                ) : customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><Link className="text-primary hover:underline" to={`/customers/${c.id}`}>{c.name}</Link></TableCell>
                    <TableCell>{c.mobile_number}</TableCell>
                    <TableCell>{c.total_orders}</TableCell>
                    <TableCell>৳{Number(c.lifetime_value || 0).toLocaleString()}</TableCell>
                    <TableCell>{c.last_order_date ? new Date(c.last_order_date).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-3">
          <div className="rounded-xl border border-border bg-card p-4">
            {timeline.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {timeline.slice(0, 100).map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.sub}</div>
                      <div className="text-[11px] text-muted-foreground/70">{new Date(t.ts).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
