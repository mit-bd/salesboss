import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SalesExecutive } from "@/types/data";

interface FormErrors {
  name?: string;
  email?: string;
  role?: string;
}

interface AddTeamMemberDialogProps {
  editMember?: SalesExecutive | null;
  onClose?: () => void;
}

export default function AddTeamMemberDialog({ editMember, onClose }: AddTeamMemberDialogProps) {
  const [open, setOpen] = useState(!!editMember);
  const { toast } = useToast();
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState({
    name: editMember?.name || "",
    email: editMember?.email || "",
    role: "sales_executive",
  });

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (!form.role) e.role = "Role is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    toast({
      title: editMember ? "Member Updated" : "Member Added",
      description: `${form.name} has been ${editMember ? "updated" : "added"} as ${form.role.replace("_", " ")}.`,
    });
    handleClose();
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const update = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof FormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  return (
    <Dialog open={editMember ? true : open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(v); }}>
      {!editMember && (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Member
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editMember ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Full Name *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Full name" className="mt-1" />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@example.com" className="mt-1" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label className="text-xs">Role *</Label>
            <Select value={form.role} onValueChange={(v) => update("role", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="sub_admin">Sub Admin</SelectItem>
                <SelectItem value="sales_executive">Sales Executive</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive mt-1">{errors.role}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit}>{editMember ? "Update" : "Add Member"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
