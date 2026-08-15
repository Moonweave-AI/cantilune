import React, { createContext, useContext, useMemo } from "react";
import {
  DEFAULT_THEME,
  createTheme,
  detectGlyphSet,
  detectTheme,
  type Theme,
  type ThemeName,
} from "./theme.js";

const ThemeContext = createContext<Theme>(DEFAULT_THEME);

let autoTheme: Theme | null = null;

/**
 * Terminal-detected theme, resolved once per process.
 *
 * Colour depth and locale cannot change mid-session, so re-detecting on every
 * render would only burn syscalls.
 */
function resolveAutoTheme(): Theme {
  autoTheme ??= detectTheme();
  return autoTheme;
}

/** Discard the cached detection. Exposed for tests that vary the environment. */
export function resetAutoTheme(): void {
  autoTheme = null;
}

export interface ThemeProviderProps {
  /** Explicit selection; when omitted the terminal-detected theme is used. */
  readonly name?: ThemeName | undefined;
  /** Fully-built theme, taking precedence over `name`. Mainly for tests. */
  readonly theme?: Theme | undefined;
  readonly children: React.ReactNode;
}

export function ThemeProvider({ name, theme, children }: ThemeProviderProps): React.ReactElement {
  const value = useMemo<Theme>(() => {
    if (theme !== undefined) return theme;
    if (name !== undefined) return createTheme(name, detectGlyphSet(process.env));
    return resolveAutoTheme();
  }, [name, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Read the active theme. Falls back to the default outside a provider. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
