import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { UpsellRecord } from "@/types/data";
import { useProductStore } from "@/contexts/ProductStoreContext";
import { useOrderStore } from "@/contexts/OrderStoreContext";
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

interface EditUpsellDialogProps {
  followupId: string;
  upsells: UpsellRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditUpsellDialog({ followupId, upsells, open, onOpenChange }: EditUpsellDialogProps) {
  const { products } = useProductStore();
  const { updateUpsellRecord, deleteUpsellRecord, addUpsellRecord } = useOrderStore();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: "", productName: "", price: "", note: "" });
  const [addMode, setAddMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setEditingId(null); setAddMode(false); }
  }, [open]);

  const startEdit = (u: UpsellRecord) => {
    setEditingId(u.id);
    setForm({ productId: u.productId || "", productName: u.productName, price: String(u.price), note: u.note });
    setAddMode(false);
  };

  const startAdd = () => {
    setAddMode(true);
    setEditingId(null);
    setForm({ productId: "", productName: "", price: "", note: "" });
  };

  const handleProductChange = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    setForm((f) => ({ ...f, productId, productName: p?.title || "", price: p ? String(p.price) : f.price }));
  };

  const handleSave = async () => {
    if (!form.productName.trim()) return;
    setSaving(true);
    try {
      const data = { productId: form.productId || null, productName: form.productName, price: Number(form.price) || 0, note: form.note };
      if (addMode) {
        await addUpsellRecord(followupId, data);
        setAddMode(false);
      } else if (editingId) {
        await updateUpsellRecord(editingId, data);
        setEditingId(null);
      }
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try { await deleteUpsellRecord(id); } catch {} finally { setSaving(false); setDeleteConfirm(null); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Upsell Records</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {upsells.map((u) => (
              <div key={u.id} className="rounded-lg border border-border p-3">
                {editingId === u.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Product</Label>
                      <Select value={form.productId} onValueChange={handleProductChange}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} - ৳{p.price}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Product Name</Label>
                        <Input value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Price (৳)</Label>
                        <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Note</Label>
                      <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="mt-1" rows={2} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={saving}>Cancel</Button>
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.productName}</p>
                      <p className="text-xs text-muted-foreground">৳{u.price}{u.note ? ` • ${u.note}` : ""}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(u)}>
                        <span className="text-xs">Edit</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(u.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addMode && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-medium text-primary">Add New Upsell</p>
                <div>
                  <Label className="text-xs">Product</Label>
                  <Select value={form.productId} onValueChange={handleProductChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} - ৳{p.price}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Product Name</Label>
                    <Input value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Price (৳)</Label>
                    <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Note</Label>
                  <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="mt-1" rows={2} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAddMode(false)} disabled={saving}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving || !form.productName.trim()}>
                    {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Add
                  </Button>
                </div>
              </div>
            )}

            {!addMode && !editingId && (
              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={startAdd}>
                <Plus className="h-3.5 w-3.5" /> Add Upsell
              </Button>
            )}

            {upsells.length === 0 && !addMode && (
              <p className="text-sm text-muted-foreground text-center py-4">No upsell records yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Upsell Record?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this upsell record. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
