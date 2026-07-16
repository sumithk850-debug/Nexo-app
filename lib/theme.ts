const THEME_KEY = "nexo_theme";

export type Theme = "light" | "dark" | "nebula" | "emerald" | "matrix" | "amethyst" | "slate";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY);
  return (stored as Theme) || "dark";
}

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  
  // Remove all theme classes
  root.classList.remove("light", "dark", "theme-nebula", "theme-emerald", "theme-matrix", "theme-amethyst", "theme-slate");
  
  if (theme === "light") {
    root.classList.add("light");
  } else if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.add("dark"); // Base custom themes on dark
    root.classList.add(`theme-${theme}`);
  }
  
  localStorage.setItem(THEME_KEY, theme);
}

export function toggleTheme(): Theme {
  const current = getStoredTheme();
  const next: Theme = current === "light" ? "dark" : "light";
  applyTheme(next);
  return next;
}
