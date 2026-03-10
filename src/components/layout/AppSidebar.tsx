import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import {
  LayoutDashboard, ShoppingCart, PhoneForwarded, Package, Users,
  RefreshCw, ArrowUpRight, Upload, Settings, Truck, BarChart3,
  Trash2, Shield, Download, Database, Target, LogOut, KeyRound,
  ChevronDown, ChevronRight, Globe, Building2, UserPlus, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { useOrderStore } from "@/contexts/OrderStoreContext";
import { useOwnerProject } from "@/contexts/OwnerProjectContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  icon: any;
  path: string;
  permission?: string;
  children?: NavChildItem[];
}

interface NavChildItem {
  label: string;
  path: string;
  permission?: string;
  stepNumber: number;
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
      {
        label: "Followups", icon: PhoneForwarded, path: "/followups", permission: "followups.view",
        children: [
          { label: "1st Followup", path: "/followups?step=1", permission: "followups.view", stepNumber: 1 },
          { label: "2nd Followup", path: "/followups?step=2", permission: "followups.view", stepNumber: 2 },
          { label: "3rd Followup", path: "/followups?step=3", permission: "followups.view", stepNumber: 3 },
          { label: "4th Followup", path: "/followups?step=4", permission: "followups.view", stepNumber: 4 },
          { label: "5th Followup", path: "/followups?step=5", permission: "followups.view", stepNumber: 5 },
        ],
      },
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
      { label: "Team", icon: Users, path: "/team" },
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

const ownerCategories: NavCategory[] = [
  {
    label: "Platform",
    key: "platform",
    items: [
      { label: "Owner Dashboard", icon: LayoutDashboard, path: "/owner" },
      { label: "Registration Requests", icon: UserPlus, path: "/owner/requests" },
      { label: "Projects", icon: Building2, path: "/owner/projects" },
    ],
  },
];

const STORAGE_KEY = "sidebar-expanded";
const FOLLOWUP_KEY = "sidebar-followups-expanded";

function getInitialExpanded(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return Object.fromEntries([...navCategories, ...ownerCategories].map((c) => [c.key, true]));
}

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, role, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const { activeOrders } = useOrderStore();
  const { isInAdminMode, impersonatedProject, exitProject } = useOwnerProject();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(getInitialExpanded);
  const [followupsOpen, setFollowupsOpen] = useState(() => {
    try { return localStorage.getItem(FOLLOWUP_KEY) !== "false"; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded)); } catch {}
  }, [expanded]);

  useEffect(() => {
    try { localStorage.setItem(FOLLOWUP_KEY, String(followupsOpen)); } catch {}
  }, [followupsOpen]);

  const stepCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const order of activeOrders) {
      const step = order.followupStep;
      if (step >= 1 && step <= 5 && order.currentStatus === "pending") counts[step]++;
    }
    return counts;
  }, [activeOrders]);

  const toggleCategory = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (path: string) => {
    const [itemPath, itemQuery] = path.split("?");
    if (itemQuery) return location.pathname === itemPath && location.search === `?${itemQuery}`;
    return location.pathname === itemPath && !location.search;
  };

  const isOwner = role === "owner";
  // Owner in admin mode sees project nav; otherwise owner sees owner nav
  const categories = (isOwner && !isInAdminMode) ? ownerCategories : navCategories;

  const visibleCategories = (isOwner && isInAdminMode)
    ? categories // Owner in admin mode sees all categories
    : categories
        .map((cat) => ({
          ...cat,
          items: cat.items.filter((item) => !item.permission || hasPermission(item.permission)),
        }))
        .filter((cat) => cat.items.length > 0);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleExitAdminMode = () => {
    exitProject();
    navigate("/owner/projects");
  };

  const renderNavItem = (item: NavItem) => {
    if (item.children) {
      const visibleChildren = (isOwner && isInAdminMode)
        ? item.children
        : item.children.filter((c) => !c.permission || hasPermission(c.permission));
      if (visibleChildren.length === 0) return null;
      const parentActive = isActive(item.path);
      const anyChildActive = visibleChildren.some((c) => isActive(c.path));

      return (
        <div key={item.path}>
          <div className="flex items-center">
            <Link
              to={item.path}
              className={cn(
                "flex flex-1 items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-fast",
                parentActive || anyChildActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
            <button
              onClick={() => setFollowupsOpen((p) => !p)}
              className="mr-1 rounded p-1 text-sidebar-muted hover:text-sidebar-foreground transition-fast"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", followupsOpen && "rotate-90")} />
            </button>
          </div>
          <div className={cn("overflow-hidden transition-all duration-200", followupsOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0")}>
            <div className="space-y-0.5 pt-0.5">
              {visibleChildren.map((child) => {
                const active = isActive(child.path);
                const count = stepCounts[child.stepNumber] || 0;
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md pl-9 pr-3 py-1.5 text-xs font-medium transition-fast",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-sidebar-muted shrink-0" />
                    <span className="truncate flex-1">{child.label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold justify-center">
                        {count}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-fast",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

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

      {/* Admin Mode Banner */}
      {isInAdminMode && impersonatedProject && (
        <div className="px-3 py-2 border-b border-sidebar-border bg-primary/5">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">Admin Mode</p>
          <p className="text-xs text-sidebar-foreground truncate">{impersonatedProject.businessName}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 w-full text-xs justify-start gap-1.5 text-sidebar-muted hover:text-sidebar-foreground"
            onClick={handleExitAdminMode}
          >
            <ArrowLeft className="h-3 w-3" />Exit to Owner Panel
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {visibleCategories.map((cat) => (
          <div key={cat.key}>
            <button
              onClick={() => toggleCategory(cat.key)}
              className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground transition-fast"
            >
              <span>{cat.label}</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", expanded[cat.key] ? "rotate-0" : "-rotate-90")} />
            </button>
            <div className={cn("overflow-hidden transition-all duration-200", expanded[cat.key] ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0")}>
              <div className="space-y-0.5 pb-2">
                {cat.items.map((item) => renderNavItem(item))}
              </div>
            </div>
          </div>
        ))}
      </nav>

      {/* Theme Switcher */}
      <div className="border-t border-sidebar-border px-4 py-2.5 shrink-0">
        <ThemeSwitcher />
      </div>

      {/* User Footer */}
      <div className="border-t border-sidebar-border p-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{displayName}</p>
            <p className="text-xs text-sidebar-muted truncate capitalize">
              {isInAdminMode ? "Owner (Admin Mode)" : (role?.replace("_", " ") || "User")}
            </p>
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
