import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";

import { database } from "./db";

// Wording mode. The same data and the same screens; only the vocabulary moves
// between plain English and ledger English. Double-entry is a mode here, not a
// default — see the 31 Jul 2026 design-system changelog.
//
// Persisted through WatermelonDB's own key/value store so the choice survives a
// restart without adding a storage dependency.

export type Wording = "normal" | "finance";

const TERMS = {
  totalMoney: { normal: "Total money", finance: "Net worth" },
  history: { normal: "History", finance: "Journal" },
  buckets: { normal: "Buckets", finance: "Accounts" },
  addEntry: { normal: "Add money move", finance: "New entry" },
  outOf: { normal: "Out of", finance: "Credit" },
  into: { normal: "Into", finance: "Debit" },
  safeToSpend: { normal: "Safe to spend", finance: "Unallocated" },
} as const;

export type TermKey = keyof typeof TERMS;

/** The full mapping, in the order the Wording screen presents it. */
export const TERM_ROWS = (Object.keys(TERMS) as TermKey[]).map((key) => ({
  key,
  normal: TERMS[key].normal,
  finance: TERMS[key].finance,
}));

export function term(key: TermKey, mode: Wording): string {
  return TERMS[key][mode];
}

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
