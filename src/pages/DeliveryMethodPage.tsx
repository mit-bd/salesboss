import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDeliveryMethods, DeliveryMethod } from "@/hooks/useDeliveryMethods";
import { Skeleton } from "@/components/ui/skeleton";

export default function DeliveryMethodPage() {
  const { toast } = useToast();
  const { methods: partners, loading, addMethod, updateMethod } = useDeliveryMethods();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<DeliveryMethod | null>(null);
  const [form, setForm] = useState({ name: "", contactInfo: "", notes: "" });
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditPartner(null);
    setForm({ name: "", contactInfo: "", notes: "" });
    setNameError("");
    setDialogOpen(true);
  };

  const openEdit = (dp: DeliveryMethod) => {
    setEditPartner(dp);
    setForm({ name: dp.name, contactInfo: dp.contactInfo, notes: dp.notes });
    setNameError("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setNameError("Name is required"); return; }
    setSaving(true);
    if (editPartner) {
      const { error } = await updateMethod(editPartner.id, form);
      if (!error) toast({ title: "Updated", description: `${form.name} has been updated.` });
      else toast({ title: "Error", description: "Failed to update.", variant: "destructive" });
    } else {
      const { error } = await addMethod(form);
      if (!error) toast({ title: "Added", description: `${form.name} has been added as a delivery partner.` });
      else toast({ title: "Error", description: "Failed to add.", variant: "destructive" });
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const toggleActive = async (dp: DeliveryMethod) => {
    const { error } = await updateMethod(dp.id, { isActive: !dp.isActive });
    if (!error) {
      toast({ title: dp.isActive ? "Deactivated" : "Activated", description: `${dp.name} is now ${dp.isActive ? "inactive" : "active"}.` });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Delivery Methods" description="Manage delivery partners and methods" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Delivery Methods" description="Manage delivery partners and methods">
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Partner
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
        {partners.map((dp) => (
          <div
            key={dp.id}
            className={cn(
              "rounded-xl border bg-card p-5 card-shadow hover:card-shadow-hover transition-fast relative group",
              dp.isActive ? "border-border" : "border-border opacity-60"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", dp.isActive ? "bg-primary/10" : "bg-muted")}>
                  <Truck className={cn("h-5 w-5", dp.isActive ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{dp.name}</p>
                  {dp.contactInfo && <p className="text-xs text-muted-foreground">{dp.contactInfo}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(dp)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 transition-fast hover:bg-muted">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <Switch checked={dp.isActive} onCheckedChange={() => toggleActive(dp)} />
              </div>
            </div>
            {dp.notes && <p className="text-xs text-muted-foreground">{dp.notes}</p>}
            <div className="mt-2">
              <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium", dp.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                {dp.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPartner ? "Edit Delivery Partner" : "Add Delivery Partner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Partner Name *</Label>
              <Input value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setNameError(""); }} placeholder="e.g. Sundarban Courier" className="mt-1" />
              {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
            </div>
            <div>
              <Label className="text-xs">Contact Info</Label>
              <Input value={form.contactInfo} onChange={(e) => setForm((f) => ({ ...f, contactInfo: e.target.value }))} placeholder="Phone or email" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." className="mt-1" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>{editPartner ? "Update" : "Add Partner"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
