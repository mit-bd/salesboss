import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useOrderSources } from "@/hooks/useOrderSources";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

export default function OrderSourcesPage() {
  const { sources, loading, addSource, updateSource, deleteSource } = useOrderSources();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    if (sources.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
      toast({ title: "Duplicate", description: "Source name already exists.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await addSource(name.trim());
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Source Added", description: `"${name.trim()}" added successfully.` });
      setName("");
      setAddOpen(false);
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!name.trim()) return;
    if (sources.some((s) => s.id !== editId && s.name.toLowerCase() === name.trim().toLowerCase())) {
      toast({ title: "Duplicate", description: "Source name already exists.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await updateSource(editId, { name: name.trim() });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Source Updated" });
      setEditOpen(false);
    }
    setSaving(false);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const { error } = await updateSource(id, { isActive });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this source? Existing orders will keep their source value.")) return;
    const { error } = await deleteSource(id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Source Deleted" });
    }
  };

  const openEdit = (id: string, currentName: string) => {
    setEditId(id);
    setName(currentName);
    setEditOpen(true);
  };

  return (
    <AppLayout>
      <PageHeader title="Order Sources" description="Manage order source channels">
        <Button size="sm" className="gap-1.5" onClick={() => { setName(""); setAddOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Source
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card card-shadow animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source Name</TableHead>
              <TableHead className="w-24 text-center">Type</TableHead>
              <TableHead className="w-24 text-center">Active</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : sources.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No sources found.</TableCell></TableRow>
            ) : (
              sources.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={s.isSystem ? "secondary" : "outline"} className="text-xs">
                      {s.isSystem ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={s.isActive} onCheckedChange={(v) => handleToggle(s.id, v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s.id, s.name)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!s.isSystem && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Order Source</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">Source Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Instagram" className="mt-1" onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Source Name</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">Source Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" onKeyDown={(e) => e.key === "Enter" && handleEdit()} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleEdit} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
