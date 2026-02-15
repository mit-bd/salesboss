import { createContext, useContext, ReactNode } from "react";
import { UserRole } from "@/types/data";

interface RoleContextType {
  role: UserRole;
  isAdmin: boolean;
}

const RoleContext = createContext<RoleContextType>({ role: "admin", isAdmin: true });

export function RoleProvider({ role = "admin", children }: { role?: UserRole; children: ReactNode }) {
  return (
    <RoleContext.Provider value={{ role, isAdmin: role === "admin" }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
