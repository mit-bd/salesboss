import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, User, Mail, Bell, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const { isAdmin } = useRole();
  const [profileImage, setProfileImage] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [originalForm, setOriginalForm] = useState({ name: "", phone: "" });

  // Hydrate from DB profile

  const isDirty = useMemo(() => {
    return form.name !== originalForm.name || form.phone !== originalForm.phone || imageFile !== null;
  }, [form, originalForm, imageFile]);

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);



  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfileImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    let avatarUrl = profile?.avatar_url || "";

    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, imageFile);
      if (uploadError) {
        console.error("Avatar upload error:", uploadError);
        toast({ title: "Upload Failed", description: uploadError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      avatarUrl = data.publicUrl;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        avatar_url: avatarUrl,
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("Profile update error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      setImageFile(null);
      setOriginalForm({ name: form.name.trim(), phone: form.phone.trim() });
      toast({ title: "Profile Updated", description: "Your profile has been saved." });
    }
    setSaving(false);
  };


  return (
    <AppLayout>
      <PageHeader title="Settings" description="Application configuration" />

      <div className="max-w-2xl space-y-6 animate-fade-in">
        {/* Profile */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </h3>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted overflow-hidden border-2 border-border">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-fast">
                <Upload className="h-3 w-3" /> Upload Photo
              </span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Full Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+880..." className="mt-1" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Email: {user?.email}</p>
          <div className="flex items-center justify-end gap-3 mt-4">
            {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
            <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Profile
            </Button>
          </div>
        </div>

        {/* Email Report Automation — not yet implemented */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Mail className="h-4 w-4" /> Email Report Automation
          </h3>
          <p className="text-sm text-muted-foreground">
            Scheduled email reports are not yet available. This module will let admins configure recipients, frequency,
            and report contents once the backend email pipeline is provisioned. No settings are persisted here today.
          </p>
        </div>



        {/* Notifications */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </h3>
          <p className="text-sm text-muted-foreground">Configure followup reminders and alert preferences.</p>
        </div>

        {/* Roles */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-1">Roles & Permissions</h3>
          <p className="text-sm text-muted-foreground">Manage admin, sub-admin, and sales executive roles.</p>
        </div>
      </div>
    </AppLayout>
  );
}
