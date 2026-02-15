import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { mockDeliveryPartners } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Truck, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DeliveryPartner } from "@/types/data";

export default function DeliveryMethodPage() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<DeliveryPartner[]>(mockDeliveryPartners);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<DeliveryPartner | null>(null);
  const [form, setForm] = useState({ name: "", contactInfo: "", notes: "" });
  const [nameError, setNameError] = useState("");

  const openAdd = () => {
    setEditPartner(null);
    setForm({ name: "", contactInfo: "", notes: "" });
    setNameError("");
    setDialogOpen(true);
  };

  const openEdit = (dp: DeliveryPartner) => {
    setEditPartner(dp);
    setForm({ name: dp.name, contactInfo: dp.contactInfo, notes: dp.notes });
    setNameError("");
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { setNameError("Name is required"); return; }
    if (editPartner) {
      setPartners((prev) => prev.map((p) => p.id === editPartner.id ? { ...p, ...form } : p));
      toast({ title: "Updated", description: `${form.name} has been updated.` });
    } else {
      const newPartner: DeliveryPartner = {
        id: `dp${Date.now()}`,
        name: form.name,
        contactInfo: form.contactInfo,
        notes: form.notes,
        active: true,
      };
      setPartners((prev) => [...prev, newPartner]);
      toast({ title: "Added", description: `${form.name} has been added as a delivery partner.` });
    }
    setDialogOpen(false);
  };

  const toggleActive = (id: string) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, active: !p.active };
          toast({ title: updated.active ? "Activated" : "Deactivated", description: `${p.name} is now ${updated.active ? "active" : "inactive"}.` });
          return updated;
        }
        return p;
      })
    );
  };

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
              dp.active ? "border-border" : "border-border opacity-60"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", dp.active ? "bg-primary/10" : "bg-muted")}>
                  <Truck className={cn("h-5 w-5", dp.active ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{dp.name}</p>
                  {dp.contactInfo && <p className="text-xs text-muted-foreground">{dp.contactInfo}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(dp)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 transition-fast hover:bg-muted">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => toggleActive(dp.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-fast">
                  {dp.active ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {dp.notes && <p className="text-xs text-muted-foreground">{dp.notes}</p>}
            <div className="mt-2">
              <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium", dp.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                {dp.active ? "Active" : "Inactive"}
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
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>{editPartner ? "Update" : "Add Partner"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
