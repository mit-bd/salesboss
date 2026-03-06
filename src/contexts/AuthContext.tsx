import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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
  const initDone = useRef(false);

  const fetchRole = async (userId: string) => {
    console.log("[Auth] Fetching role for:", userId);
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const detectedRole = (data?.role as UserRole) ?? null;
    console.log("[Auth] Role detected:", detectedRole);
    setRole(detectedRole);
    setRoleChecked(true);
    return detectedRole;
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

  const loadUserData = async (userId: string) => {
    console.log("[Auth] Loading user data for:", userId);
    await Promise.all([
      fetchRole(userId),
      fetchProfile(userId),
      fetchRequestStatus(userId),
    ]);
    console.log("[Auth] User data loaded, setting loading=false");
    setLoading(false);
  };

  const refreshRole = async () => {
    if (user) await fetchRole(user.id);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("[Auth] onAuthStateChange event:", _event);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Only load data if initial getSession hasn't handled it
          if (initDone.current) {
            loadUserData(session.user.id);
          }
        } else {
          setRole(null);
          setProfile(null);
          setRoleChecked(false);
          setRequestStatus(null);
          setLoading(false);
        }
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[Auth] getSession result:", session ? "has session" : "no session");
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id).then(() => {
          initDone.current = true;
        });
      } else {
        setLoading(false);
        initDone.current = true;
      }
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
