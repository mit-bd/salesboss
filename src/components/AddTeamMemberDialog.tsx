import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}

interface TeamUser {
  id: string;
  email: string;
  fullName: string;
  role: string | null;
}

interface AddTeamMemberDialogProps {
  editMember?: TeamUser | null;
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function AddTeamMemberDialog({ editMember, onClose, onSuccess }: AddTeamMemberDialogProps) {
  const [open, setOpen] = useState(!!editMember);
  const { toast } = useToast();
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: editMember?.fullName || "",
    email: editMember?.email || "",
    password: "",
    role: editMember?.role || "sales_executive",
  });

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (!editMember && !form.password) e.password = "Password is required";
    else if (!editMember && form.password.length < 6) e.password = "Min 6 characters";
    if (!form.role) e.role = "Role is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      if (editMember) {
        // Update user info
        const { data: updateData, error: updateError } = await supabase.functions.invoke("manage-team", {
          body: { action: "update_user", userId: editMember.id, fullName: form.name.trim(), email: form.email.trim() },
        });
        if (updateError || updateData?.error) throw new Error(updateData?.error || updateError?.message);

        // Update role if changed
        if (form.role !== editMember.role) {
          const { data: roleData, error: roleError } = await supabase.functions.invoke("manage-team", {
            body: { action: "update_role", userId: editMember.id, role: form.role },
          });
          if (roleError || roleData?.error) throw new Error(roleData?.error || roleError?.message);
        }

        // Reset password if provided
        if (form.password) {
          const { data: pwData, error: pwError } = await supabase.functions.invoke("manage-team", {
            body: { action: "reset_password", userId: editMember.id, newPassword: form.password },
          });
          if (pwError || pwData?.error) throw new Error(pwData?.error || pwError?.message);
        }

        toast({ title: "Member Updated", description: `${form.name} has been updated.` });
      } else {
        // Create new user
        const { data, error } = await supabase.functions.invoke("manage-team", {
          body: {
            action: "create",
            email: form.email.trim(),
            password: form.password,
            fullName: form.name.trim(),
            role: form.role,
          },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        toast({ title: "Member Created", description: `${form.name} can now log in with their credentials.` });
      }

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save member.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="email@example.com"
              className="mt-1"
              disabled={!!editMember}
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label className="text-xs">{editMember ? "New Password (leave blank to keep current)" : "Password *"}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder={editMember ? "••••••••" : "Min 6 characters"}
              className="mt-1"
            />
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
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
            <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editMember ? "Update" : "Create Member"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
