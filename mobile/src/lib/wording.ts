import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";

import { term, type TermKey, type Wording } from "@financially/domain/wording";
import { database } from "./db";

// The mobile wording provider. The vocabulary itself lives in
// shared-context/domain/wording.ts and is shared with web; only persistence and
// the React context are per-client — WatermelonDB's key/value store keeps the
// choice across restarts without adding a storage dependency.

export * from "@financially/domain/wording";

const MODE_KEY = "wording_mode";
const SIDES_KEY = "wording_show_sides";

type WordingState = {
  mode: Wording;
  /** Whether entries expose their debit and credit lines. */
  showSides: boolean;
  setMode: (m: Wording) => void;
  setShowSides: (v: boolean) => void;
  /** Shorthand: `t("history")` in the active mode. */
  t: (key: TermKey) => string;
};

const WordingContext = createContext<WordingState>({
  mode: "normal",
  showSides: false,
  setMode: () => {},
  setShowSides: () => {},
  t: (key) => term(key, "normal"),
});

export function WordingProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Wording>("normal");
  const [showSides, setShowSidesState] = useState(false);

  // Hydrate once. A missing or unreadable value simply leaves the plain
  // default in place — wording is a preference, not something to fail on.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [saved, sides] = await Promise.all([
          database.localStorage.get<string>(MODE_KEY),
          database.localStorage.get<string>(SIDES_KEY),
        ]);
        if (!alive) return;
        if (saved === "finance") setModeState("finance");
        if (sides === "1") setShowSidesState(true);
      } catch {
        // keep defaults
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<WordingState>(
    () => ({
      mode,
      showSides,
      setMode: (m) => {
        setModeState(m);
        // Finance wording implies the ledger detail; turning it off is still
        // the user's call afterwards.
        if (m === "finance") setShowSidesState(true);
        void database.localStorage.set(MODE_KEY, m);
        if (m === "finance") void database.localStorage.set(SIDES_KEY, "1");
      },
      setShowSides: (v) => {
        setShowSidesState(v);
        void database.localStorage.set(SIDES_KEY, v ? "1" : "0");
      },
      t: (key) => term(key, mode),
    }),
    [mode, showSides],
  );

  return createElement(WordingContext.Provider, { value }, children);
}

export function useWording(): WordingState {
  return useContext(WordingContext);
}
