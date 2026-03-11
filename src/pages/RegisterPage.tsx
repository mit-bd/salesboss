import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PhoneForwarded, Loader2, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ownerExists, setOwnerExists] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkOwner = async () => {
      try {
        const { data } = await supabase.functions.invoke("manage-team", {
          body: { action: "check_owner_exists" },
        });
        setOwnerExists(data?.ownerExists || false);
      } catch {
        setOwnerExists(false);
      }
      setChecking(false);
    };
    checkOwner();
  }, []);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const metadata: Record<string, string> = { full_name: fullName };

    if (ownerExists) {
      // Business registration — include business info for trigger
      metadata.business_name = businessName;
      metadata.phone = phone;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/verification-pending");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <PhoneForwarded className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {ownerExists ? "Register Your Business" : "Create Owner Account"}
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            {ownerExists
              ? "Register your business. Access will be granted after approval."
              : "Set up the system owner account"}
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {ownerExists && (
            <div>
              <Label className="text-xs">Business Name</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business name"
                required
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label className="text-xs">{ownerExists ? "Owner Name" : "Full Name"}</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1"
            />
          </div>
          {ownerExists && (
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                required
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
              minLength={6}
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ownerExists ? "Submit Registration" : "Create Owner Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-muted-foreground">
        © 2026 Motion IT BD. All rights reserved.
      </p>
    </div>
  );
}
