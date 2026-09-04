import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

export type Theme = "light" | "dark";
const themeKey = "grant-review.theme";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({ theme: "light", toggleTheme: () => undefined });

export function preferredTheme(): Theme {
  const saved = localStorage.getItem(themeKey);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) { document.documentElement.dataset.theme = theme; }

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>(preferredTheme);
  useEffect(() => { applyTheme(theme); localStorage.setItem(themeKey, theme); }, [theme]);
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((value) => value === "light" ? "dark" : "light") }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "light" ? "dark" : "light";
  return <button className="icon-button theme-toggle" type="button" onClick={toggleTheme} aria-label={`Use ${next} mode`} title={`Use ${next} mode`}><span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span></button>;
}
