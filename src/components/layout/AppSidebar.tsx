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
  Truck,
  BarChart3,
  Trash2,
  Shield,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", adminOnly: false },
  { label: "All Orders", icon: ShoppingCart, path: "/orders", adminOnly: false },
  { label: "Followups", icon: PhoneForwarded, path: "/followups", adminOnly: false },
  { label: "Repeat Orders", icon: RefreshCw, path: "/repeat-orders", adminOnly: false },
  { label: "Sales Executives", icon: BarChart3, path: "/sales-executives", adminOnly: false },
  { label: "Products", icon: Package, path: "/products", adminOnly: false },
  { label: "Delivery Methods", icon: Truck, path: "/delivery-methods", adminOnly: false },
  { label: "Bulk Import", icon: Upload, path: "/bulk-import", adminOnly: false },
  { label: "Team", icon: Users, path: "/team", adminOnly: false },
  { label: "Deleted Orders", icon: Trash2, path: "/deleted-orders", adminOnly: true },
  { label: "Audit Logs", icon: Shield, path: "/audit-logs", adminOnly: true },
  { label: "Export & Backup", icon: Download, path: "/export", adminOnly: true },
  { label: "Settings", icon: Settings, path: "/settings", adminOnly: false },
];

const followupBadges: Record<string, number> = {
  "/followups": 7,
};

export default function AppSidebar() {
  const location = useLocation();
  const { isAdmin } = useRole();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <PhoneForwarded className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <span className="text-base font-semibold text-sidebar-primary-foreground tracking-tight">
          SalesBoss
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
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
