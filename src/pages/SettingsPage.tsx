import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [profileImage, setProfileImage] = useState<string>("");
  const [form, setForm] = useState({
    name: "Admin User",
    email: "admin@salesboss.com",
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfileImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    toast({ title: "Profile Updated", description: "Your profile has been updated successfully." });
  };

  return (
    <AppLayout>
      <PageHeader title="Settings" description="Application configuration" />

      <div className="max-w-2xl space-y-6 animate-fade-in">
        {/* Profile */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-4">Profile</h3>
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
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button size="sm" onClick={handleSave}>Save Changes</Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-1">Notifications</h3>
          <p className="text-sm text-muted-foreground">Configure followup reminders and alert preferences.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold text-foreground mb-1">Roles & Permissions</h3>
          <p className="text-sm text-muted-foreground">Manage admin, sub-admin, and sales executive roles.</p>
        </div>
      </div>
    </AppLayout>
  );
}
