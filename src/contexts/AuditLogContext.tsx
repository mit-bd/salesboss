import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface AuditLogEntry {
  id: string;
  actionType: string;
  userName: string;
  role: string;
  entity: string;
  details?: string;
  timestamp: string;
}

interface AuditLogContextType {
  logs: AuditLogEntry[];
  addLog: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => void;
}

const AuditLogContext = createContext<AuditLogContextType>({
  logs: [],
  addLog: () => {},
});

let logCounter = 0;

export function AuditLogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  const addLog = useCallback(
    (entry: Omit<AuditLogEntry, "id" | "timestamp">) => {
      logCounter++;
      const newEntry: AuditLogEntry = {
        ...entry,
        id: `log-${logCounter}-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      setLogs((prev) => [newEntry, ...prev]);
    },
    []
  );

  return (
    <AuditLogContext.Provider value={{ logs, addLog }}>
      {children}
    </AuditLogContext.Provider>
  );
}

export function useAuditLog() {
  return useContext(AuditLogContext);
}
