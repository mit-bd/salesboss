import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", path: "/owner" },
  { label: "Registration Requests", path: "/owner/requests", badge: true },
  { label: "Project Status", path: "/owner/project-status" },
  { label: "Users Manager", path: "/owner/users" },
  { label: "System Logs", path: "/owner/logs" },
];

interface OwnerLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  pendingCount?: number;
}

export default function OwnerLayout({ children, title, subtitle, pendingCount }: OwnerLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <nav className="flex gap-1 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path}>
              <Button
                variant={location.pathname === item.path ? "default" : "ghost"}
                size="sm"
                className="shrink-0"
              >
                {item.label}
                {item.badge && (pendingCount ?? 0) > 0 && (
                  <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}
