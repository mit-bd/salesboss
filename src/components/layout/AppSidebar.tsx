import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  PhoneForwarded,
  Package,
  Users,
  RefreshCw,
  ArrowUpRight,
  Upload,
  Settings,
  Truck,
  BarChart3,
  Trash2,
  Shield,
  Download,
  Database,
  Target,
  LogOut,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  icon: any;
  path: string;
  permission?: string; // required permission key
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "All Orders", icon: ShoppingCart, path: "/orders", permission: "orders.view" },
  { label: "Followups", icon: PhoneForwarded, path: "/followups", permission: "followups.view" },
  { label: "Repeat Orders", icon: RefreshCw, path: "/repeat-orders", permission: "orders.view" },
  { label: "Upsell", icon: ArrowUpRight, path: "/upsell", permission: "followups.view" },
  { label: "Sales Executives", icon: BarChart3, path: "/sales-executives", permission: "sales.view_performance" },
  { label: "Targets & Commission", icon: Target, path: "/commission", permission: "commission.view" },
  { label: "Products", icon: Package, path: "/products", permission: "products.view" },
  { label: "Delivery Methods", icon: Truck, path: "/delivery-methods", permission: "delivery.view" },
  { label: "Bulk Import", icon: Upload, path: "/bulk-import", permission: "orders.create" },
  { label: "Team", icon: Users, path: "/team" },
  { label: "Roles", icon: KeyRound, path: "/roles", permission: "roles.manage" },
  { label: "Backup Center", icon: Database, path: "/backup-center", permission: "backup.view" },
  { label: "Deleted Orders", icon: Trash2, path: "/deleted-orders", permission: "orders.delete" },
  { label: "Audit Logs", icon: Shield, path: "/audit-logs", permission: "audit.view" },
  { label: "Export & Backup", icon: Download, path: "/export", permission: "backup.export" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export default function AppSidebar() {
  const location = useLocation();
  const { user, profile, role, signOut } = useAuth();
  const { hasPermission } = usePermissions();

  const visibleItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{displayName}</p>
            <p className="text-xs text-sidebar-muted truncate capitalize">{role?.replace("_", " ") || "User"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-sidebar-muted hover:text-sidebar-accent-foreground"
            onClick={signOut}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
