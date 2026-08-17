import { describe, expect, it } from "vitest";

import { catalog, strings } from "./index";

describe("string catalog", () => {
  it("resolves a mode pair to the active mode's side", () => {
    expect(strings("normal").reports.netWorth).toBe("Total money");
    expect(strings("finance").reports.netWorth).toBe("Net worth");
  });

  it("leaves mode-independent leaves alone", () => {
    expect(strings("finance").reports.title).toBe("Reports");
    expect(strings("normal").common.entries(1)).toBe("entry");
    expect(strings("normal").common.entries(2)).toBe("entries");
  });

  it("says a period as a month name, never as a key", () => {
    expect(strings("normal").budgets.periodTitle("2026-08-01")).toBe("August");
  });

  it("resolves every mode pair, at every depth", () => {
    const unresolved: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node !== "object" || node === null) return;
      const keys = Object.keys(node);
      if (keys.length === 2 && "normal" in node && "finance" in node) {
        unresolved.push(path);
        return;
      }
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    };
    walk(strings("normal"), "");
    expect(unresolved).toEqual([]);
  });

  it("keeps the seven switchable terms mode-aware", () => {
    for (const key of Object.keys(catalog.terms)) {
      const pair = catalog.terms[key as keyof typeof catalog.terms];
      expect(pair.normal).not.toBe(pair.finance);
    }
  });
});
