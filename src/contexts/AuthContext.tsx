import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/types/data";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  profile: { full_name: string; phone: string; avatar_url: string; project_id: string | null } | null;
  loading: boolean;
  roleChecked: boolean;
  requestStatus: string | null;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  profile: null,
  loading: true,
  roleChecked: false,
  requestStatus: null,
  signOut: async () => {},
  refreshRole: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; phone: string; avatar_url: string; project_id: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleChecked, setRoleChecked] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    setRole((data?.role as UserRole) ?? null);
    setRoleChecked(true);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await (supabase.from("profiles") as any)
      .select("full_name, phone, avatar_url, project_id")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile(data ?? null);
  };

  const fetchRequestStatus = async (userId: string) => {
    const { data } = await (supabase.from as any)("project_requests")
      .select("status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRequestStatus(data?.status ?? null);
  };

  const refreshRole = async () => {
    if (user) await fetchRole(user.id);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchRole(session.user.id);
            fetchProfile(session.user.id);
            fetchRequestStatus(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
          setRoleChecked(false);
          setRequestStatus(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
        fetchProfile(session.user.id);
        fetchRequestStatus(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setProfile(null);
    setRoleChecked(false);
    setRequestStatus(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, profile, loading, roleChecked, requestStatus, signOut, refreshRole, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
