import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { term, type TermKey, type Wording } from "@financially/domain/wording";

// The web wording provider. The vocabulary itself lives in
// shared-context/domain/wording.ts and is shared with mobile; only persistence
// and the React context are per-client.

export * from "@financially/domain/wording";

const MODE_KEY = "fa_wording_mode";
const SIDES_KEY = "fa_wording_show_sides";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Wording is a preference, not something to fail on.
  }
}

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

export function WordingProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Wording>(() =>
    read(MODE_KEY) === "finance" ? "finance" : "normal",
  );
  const [showSides, setShowSidesState] = useState(() => read(SIDES_KEY) === "1");

  const value = useMemo<WordingState>(
    () => ({
      mode,
      showSides,
      setMode: (m) => {
        setModeState(m);
        write(MODE_KEY, m);
        // Finance wording implies the ledger detail; turning it back off is
        // still the user's call afterwards.
        if (m === "finance") {
          setShowSidesState(true);
          write(SIDES_KEY, "1");
        }
      },
      setShowSides: (v) => {
        setShowSidesState(v);
        write(SIDES_KEY, v ? "1" : "0");
      },
      t: (key) => term(key, mode),
    }),
    [mode, showSides],
  );

  return <WordingContext.Provider value={value}>{children}</WordingContext.Provider>;
}

export function useWording(): WordingState {
  return useContext(WordingContext);
}
