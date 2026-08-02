import { useSyncExternalStore } from "react";
import { colorScheme } from "nativewind";

import { database } from "./db";

// Appearance preference. DESIGN.md defines both palettes, and nativewind has
// followed the OS since — this only adds the override, for the people whose
// phone is dark all day but who want to read their money in light (or the
// reverse). "system" stays the default, so nothing changes for anyone who
// never opens the screen.
//
// A module store rather than a context because the choice has to apply to the
// unauthenticated screens too, which render outside the app shell's providers.

export type ThemePreference = "system" | "light" | "dark";

const KEY = "theme_preference";

let preference: ThemePreference = "system";
const listeners = new Set<() => void>();

function isPreference(v: unknown): v is ThemePreference {
  return v === "system" || v === "light" || v === "dark";
}

export function themePreference(): ThemePreference {
  return preference;
}

/**
 * Restores the saved choice and applies it. Call once at startup, before the
 * first frame — applying it later means a visible flash of the wrong palette.
 */
export async function hydrateTheme(): Promise<void> {
  try {
    const saved = await database.localStorage.get<string>(KEY);
    if (isPreference(saved)) preference = saved;
  } catch {
    // Appearance is a preference, not something to fail startup over.
  }
  colorScheme.set(preference);
  for (const l of listeners) l();
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  // `system` hands control back to the OS rather than freezing whatever it
  // happened to be at the moment of the switch.
  colorScheme.set(next);
  for (const l of listeners) l();
  void database.localStorage.set(KEY, next);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, themePreference, themePreference);
}
