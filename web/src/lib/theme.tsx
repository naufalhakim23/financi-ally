import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// Appearance. `system` follows the OS and keeps following it, which is why the
// stored value is the *preference*, not the resolved scheme.

export type ThemePref = "system" | "light" | "dark";

const KEY = "fa_theme";

function stored(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

type ThemeState = { pref: ThemePref; setPref: (p: ThemePref) => void };
const ThemeContext = createContext<ThemeState>({ pref: "system", setPref: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(stored);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = pref === "dark" || (pref === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    if (pref !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [pref]);

  const value = useMemo<ThemeState>(
    () => ({
      pref,
      setPref: (p) => {
        setPrefState(p);
        try {
          localStorage.setItem(KEY, p);
        } catch {
          // Appearance is a preference, not something to fail on.
        }
      },
    }),
    [pref],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
