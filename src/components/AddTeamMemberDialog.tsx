import { useEffect, useState } from "react";
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
  phone?: string;
  role: string | null;
  employeeId?: string | null;
  department?: string | null;
  supervisorId?: string | null;
}

interface SupervisorOption {
  id: string;
  fullName: string;
  role: string | null;
}

interface AddTeamMemberDialogProps {
  editMember?: TeamUser | null;
  onClose?: () => void;
  onSuccess?: () => void;
  supervisors?: SupervisorOption[];
}

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "sub_admin", label: "Sub Admin" },
  { value: "manager", label: "Manager" },
  { value: "team_leader", label: "Team Leader" },
  { value: "sales_executive", label: "Sales Executive" },
];

export default function AddTeamMemberDialog({ editMember, onClose, onSuccess, supervisors = [] }: AddTeamMemberDialogProps) {
  const [open, setOpen] = useState(!!editMember);
  const { toast } = useToast();
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: editMember?.fullName || "",
    email: editMember?.email || "",
    phone: editMember?.phone || "",
    password: "",
    role: editMember?.role || "sales_executive",
    employeeId: editMember?.employeeId || "",
    department: editMember?.department || "",
    supervisorId: editMember?.supervisorId || "none",
  });

  useEffect(() => {
    if (editMember) {
      setForm({
        name: editMember.fullName || "",
        email: editMember.email || "",
        phone: editMember.phone || "",
        password: "",
        role: editMember.role || "sales_executive",
        employeeId: editMember.employeeId || "",
        department: editMember.department || "",
        supervisorId: editMember.supervisorId || "none",
      });
    }
  }, [editMember]);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (!editMember && !form.password) e.password = "Password is required";
    else if (!editMember && form.password.length < 6) e.password = "Min 6 characters";
    if (form.password && form.password.length > 0 && form.password.length < 6) e.password = "Min 6 characters";
    if (!form.role) e.role = "Role is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      let targetUserId = editMember?.id;

      if (editMember) {
        const { data: updateData, error: updateError } = await supabase.functions.invoke("manage-team", {
          body: { action: "update_user", userId: editMember.id, fullName: form.name.trim(), email: form.email.trim() },
        });
        if (updateError || updateData?.error) throw new Error(updateData?.error || updateError?.message);

        if (form.role !== editMember.role) {
          const { data: roleData, error: roleError } = await supabase.functions.invoke("manage-team", {
            body: { action: "update_role", userId: editMember.id, role: form.role },
          });
          if (roleError || roleData?.error) throw new Error(roleData?.error || roleError?.message);
        }

        if (form.password) {
          const { data: pwData, error: pwError } = await supabase.functions.invoke("manage-team", {
            body: { action: "reset_password", userId: editMember.id, newPassword: form.password },
          });
          if (pwError || pwData?.error) throw new Error(pwData?.error || pwError?.message);
        }
      } else {
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
        targetUserId = data.userId || data.user?.id;
      }

      // Persist extended profile fields (phone/department/employee_id) + supervisor
      if (targetUserId) {
        await supabase.functions.invoke("manage-team", {
          body: {
            action: "update_profile_fields",
            userId: targetUserId,
            phone: form.phone.trim() || null,
            department: form.department.trim() || null,
          },
        });
        if (form.employeeId.trim() && form.employeeId !== (editMember?.employeeId || "")) {
          await supabase.from("profiles").update({ employee_id: form.employeeId.trim() }).eq("user_id", targetUserId);
        }
        const nextSup = form.supervisorId === "none" ? null : form.supervisorId;
        const prevSup = editMember?.supervisorId || null;
        if (nextSup !== prevSup) {
          await supabase.functions.invoke("manage-team", {
            body: { action: "update_supervisor", userId: targetUserId, supervisorId: nextSup },
          });
        }
      }

      toast({ title: editMember ? "Member Updated" : "Member Created", description: `${form.name} saved successfully.` });
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

  const eligibleSupervisors = supervisors.filter((s) => s.id !== editMember?.id);

  return (
    <Dialog open={editMember ? true : open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(v); }}>
      {!editMember && (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Member
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editMember ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <div className="md:col-span-2">
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
            <Label className="text-xs">Phone</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="01XXXXXXXXX" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Employee ID</Label>
            <Input value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} placeholder="EMP-0001" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Department</Label>
            <Input value={form.department} onChange={(e) => update("department", e.target.value)} placeholder="Sales / Support / …" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Role *</Label>
            <Select value={form.role} onValueChange={(v) => update("role", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive mt-1">{errors.role}</p>}
          </div>
          <div>
            <Label className="text-xs">Supervisor</Label>
            <Select value={form.supervisorId} onValueChange={(v) => update("supervisorId", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {eligibleSupervisors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.fullName} {s.role ? `· ${s.role.replace("_", " ")}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
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
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
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
