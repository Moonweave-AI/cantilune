export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "cln-theme";

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* private mode */
  }
  return "dark";
}

export function writeThemePreference(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark = true,
): ResolvedTheme {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.clnTheme = resolved;
  document.body.dataset.clnTheme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function cycleTheme(current: ThemePreference): ThemePreference {
  if (current === "dark") return "light";
  if (current === "light") return "system";
  return "dark";
}
