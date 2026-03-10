import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface ProjectInfo {
  id: string;
  businessName: string;
}

interface OwnerProjectContextType {
  impersonatedProject: ProjectInfo | null;
  enterProject: (project: ProjectInfo) => void;
  exitProject: () => void;
  isInAdminMode: boolean;
}

const OwnerProjectContext = createContext<OwnerProjectContextType>({
  impersonatedProject: null,
  enterProject: () => {},
  exitProject: () => {},
  isInAdminMode: false,
});

export function OwnerProjectProvider({ children }: { children: ReactNode }) {
  const [impersonatedProject, setImpersonatedProject] = useState<ProjectInfo | null>(null);

  const enterProject = useCallback((project: ProjectInfo) => {
    setImpersonatedProject(project);
  }, []);

  const exitProject = useCallback(() => {
    setImpersonatedProject(null);
  }, []);

  return (
    <OwnerProjectContext.Provider value={{
      impersonatedProject,
      enterProject,
      exitProject,
      isInAdminMode: !!impersonatedProject,
    }}>
      {children}
    </OwnerProjectContext.Provider>
  );
}

export function useOwnerProject() {
  return useContext(OwnerProjectContext);
}
