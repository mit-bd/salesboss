import { createContext, useContext, ReactNode } from "react";
import { UserRole } from "@/types/data";
import { useAuth } from "@/contexts/AuthContext";

interface RoleContextType {
  role: UserRole;
  isAdmin: boolean;
}

const RoleContext = createContext<RoleContextType>({ role: "sales_executive", isAdmin: false });

export function RoleProvider({ children }: { children: ReactNode }) {
  const { role: authRole } = useAuth();
  const role: UserRole = authRole ?? "sales_executive";
  return (
    <RoleContext.Provider value={{ role, isAdmin: role === "admin" }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
