import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  PhoneForwarded,
  Package,
  Users,
  RefreshCw,
  Upload,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Orders", icon: ShoppingCart, path: "/orders" },
  { label: "Followups", icon: PhoneForwarded, path: "/followups" },
  { label: "Repeat Orders", icon: RefreshCw, path: "/repeat-orders" },
  { label: "Products", icon: Package, path: "/products" },
  { label: "Bulk Import", icon: Upload, path: "/bulk-import" },
  { label: "Team", icon: Users, path: "/team" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const followupBadges: Record<string, number> = {
  "/followups": 7,
};

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <PhoneForwarded className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <span className="text-base font-semibold text-sidebar-primary-foreground tracking-tight">
          SalesBoss
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const badge = followupBadges[item.path];
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-fast",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[11px] font-semibold text-sidebar-primary-foreground">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">Admin User</p>
            <p className="text-xs text-sidebar-muted truncate">admin@salesboss.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
