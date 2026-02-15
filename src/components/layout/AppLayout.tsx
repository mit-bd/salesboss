import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import NotificationPanel from "@/components/NotificationPanel";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-60 min-h-screen">
        <div className="flex items-center justify-end gap-2 px-6 pt-4 lg:px-8">
          <NotificationPanel />
        </div>
        <div className="px-6 pb-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
