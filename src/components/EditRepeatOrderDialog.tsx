import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import { RepeatOrderRecord } from "@/types/data";
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

interface EditRepeatOrderDialogProps {
  repeats: RepeatOrderRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditRepeatOrderDialog({ repeats, open, onOpenChange }: EditRepeatOrderDialogProps) {
  const { products } = useProductStore();
  const { updateRepeatOrderRecord, deleteRepeatOrderRecord } = useOrderStore();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: "", productName: "", price: "", note: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setEditingId(null);
  }, [open]);

  const startEdit = (r: RepeatOrderRecord) => {
    setEditingId(r.id);
    setForm({ productId: r.productId || "", productName: r.productName, price: String(r.price), note: r.note });
  };

  const handleProductChange = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    setForm((f) => ({ ...f, productId, productName: p?.title || "", price: p ? String(p.price) : f.price }));
  };

  const handleSave = async () => {
    if (!form.productName.trim() || !editingId) return;
    setSaving(true);
    try {
      await updateRepeatOrderRecord(editingId, {
        productId: form.productId || null,
        productName: form.productName,
        price: Number(form.price) || 0,
        note: form.note,
      });
      setEditingId(null);
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try { await deleteRepeatOrderRecord(id); } catch {} finally { setSaving(false); setDeleteConfirm(null); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Repeat Order Records</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {repeats.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                {editingId === r.id ? (
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
                      <p className="text-sm font-medium text-foreground">{r.productName}</p>
                      <p className="text-xs text-muted-foreground">৳{r.price}{r.note ? ` • ${r.note}` : ""}</p>
                      {r.childOrderId && <p className="text-[10px] text-muted-foreground/60">Child: {r.childOrderId.slice(0, 8)}...</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(r)}>
                        <span className="text-xs">Edit</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {repeats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No repeat order records.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Repeat Order Record?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the repeat order record and soft-delete the associated child order. This action cannot be undone.</AlertDialogDescription>
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
