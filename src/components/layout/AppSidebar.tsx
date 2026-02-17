import { useState, useEffect } from "react";
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
  ChevronDown,
  Globe,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  icon: any;
  path: string;
  permission?: string;
}

interface NavCategory {
  label: string;
  key: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    label: "Orders",
    key: "orders",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/" },
      { label: "All Orders", icon: ShoppingCart, path: "/orders", permission: "orders.view" },
      { label: "Followups", icon: PhoneForwarded, path: "/followups", permission: "followups.view" },
      { label: "1st Followup", icon: PhoneForwarded, path: "/followups?step=1", permission: "followups.view" },
      { label: "2nd Followup", icon: PhoneForwarded, path: "/followups?step=2", permission: "followups.view" },
      { label: "3rd Followup", icon: PhoneForwarded, path: "/followups?step=3", permission: "followups.view" },
      { label: "4th Followup", icon: PhoneForwarded, path: "/followups?step=4", permission: "followups.view" },
      { label: "5th Followup", icon: PhoneForwarded, path: "/followups?step=5", permission: "followups.view" },
      { label: "Repeat Orders", icon: RefreshCw, path: "/repeat-orders", permission: "orders.view" },
      { label: "Upsell", icon: ArrowUpRight, path: "/upsell", permission: "followups.view" },
      { label: "Deleted Orders", icon: Trash2, path: "/deleted-orders", permission: "orders.delete" },
    ],
  },
  {
    label: "Operations",
    key: "operations",
    items: [
      { label: "Delivery Methods", icon: Truck, path: "/delivery-methods", permission: "delivery.view" },
      { label: "Order Sources", icon: Globe, path: "/order-sources" },
      { label: "Bulk Import", icon: Upload, path: "/bulk-import", permission: "orders.create" },
    ],
  },
  {
    label: "Performance",
    key: "performance",
    items: [
      { label: "Sales Executives", icon: BarChart3, path: "/sales-executives", permission: "sales.view_performance" },
      { label: "Commission & Targets", icon: Target, path: "/commission", permission: "commission.view" },
      { label: "Export & Reports", icon: Download, path: "/export", permission: "backup.export" },
    ],
  },
  {
    label: "Access Control",
    key: "access",
    items: [
      { label: "Team Management", icon: Users, path: "/team" },
      { label: "Roles", icon: KeyRound, path: "/roles", permission: "roles.manage" },
      { label: "Audit Logs", icon: Shield, path: "/audit-logs", permission: "audit.view" },
    ],
  },
  {
    label: "System",
    key: "system",
    items: [
      { label: "Products", icon: Package, path: "/products", permission: "products.view" },
      { label: "Backup Center", icon: Database, path: "/backup-center", permission: "backup.view" },
      { label: "Settings", icon: Settings, path: "/settings" },
    ],
  },
];

const STORAGE_KEY = "sidebar-expanded";

function getInitialExpanded(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  // Default: all expanded
  return Object.fromEntries(navCategories.map((c) => [c.key, true]));
}

export default function AppSidebar() {
  const location = useLocation();
  const { user, profile, role, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(getInitialExpanded);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
    } catch {}
  }, [expanded]);

  const toggleCategory = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (item: NavItem) => {
    const [itemPath, itemQuery] = item.path.split("?");
    if (itemQuery) {
      return location.pathname === itemPath && location.search === `?${itemQuery}`;
    }
    return location.pathname === itemPath && !location.search;
  };

  const isSubItem = (item: NavItem) => item.path.includes("?step=");

  const visibleCategories = navCategories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        if (!item.permission) return true;
        return hasPermission(item.permission);
      }),
    }))
    .filter((cat) => cat.items.length > 0);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 px-5 border-b border-sidebar-border shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <PhoneForwarded className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <span className="text-base font-semibold text-sidebar-primary-foreground tracking-tight">
          SalesBoss
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {visibleCategories.map((cat) => (
          <div key={cat.key}>
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(cat.key)}
              className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground transition-fast"
            >
              <span>{cat.label}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  expanded[cat.key] ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>

            {/* Category Items */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                expanded[cat.key] ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="space-y-0.5 pb-2">
                {cat.items.map((item) => {
                  const active = isActive(item);
                  const sub = isSubItem(item);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-fast",
                        sub && "pl-9 text-xs",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {!sub && <item.icon className="h-4 w-4 shrink-0" />}
                      {sub && <span className="h-1.5 w-1.5 rounded-full bg-sidebar-muted shrink-0" />}
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-sidebar-border p-4 shrink-0">
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
