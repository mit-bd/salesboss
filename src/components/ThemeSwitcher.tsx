import { Sun, Moon, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "night";

const THEME_KEY = "app-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "night");
  if (theme === "dark") root.classList.add("dark");
  if (theme === "night") root.classList.add("night");
  localStorage.setItem(THEME_KEY, theme);
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "night") return stored;
  } catch {}
  return "dark";
}

const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "night", icon: Star, label: "Night" },
];

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="flex items-center gap-1 rounded-lg bg-sidebar-accent p-0.5">
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          title={t.label}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-200",
            theme === t.value
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
              : "text-sidebar-muted hover:text-sidebar-foreground"
          )}
        >
          <t.icon className="h-3 w-3" />
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
