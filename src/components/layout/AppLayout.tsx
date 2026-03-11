import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import NotificationPanel from "@/components/NotificationPanel";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import AiAssistant from "@/components/AiAssistant";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-60 min-h-screen">
        <SubscriptionBanner />
        <div className="flex items-center justify-end gap-2 px-6 pt-4 lg:px-8">
          <NotificationPanel />
        </div>
        <div className="px-6 pb-6 lg:px-8">{children}</div>
        <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
          © 2026 Motion IT BD. All rights reserved.
        </footer>
      </main>
      <AiAssistant />
    </div>
  );
}
