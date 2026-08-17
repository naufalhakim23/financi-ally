import { describe, expect, it } from "vitest";

import { catalog, strings } from "./index";
import type { Resolved } from "./resolve";

// Compile-time half of the contract, checked by `tsc` rather than by vitest.
//
// `Resolved` and the runtime `isModePair` decide "is this a mode pair?"
// separately. When they first disagreed, the catalog still resolved correctly
// and every test passed — only the screens reading it stopped compiling, because
// a group that merely contained `normal` and `finance` among its keys was typed
// as `string`. No runtime assertion can see that, so these exercise the type
// directly rather than through whatever shape the catalog happens to have today.
type ExactPair = Resolved<{ normal: "a"; finance: "b" }>;
type GroupWithModeKeys = Resolved<{ normal: string; finance: string; title: string }>;

const _pairCollapses: "a" | "b" = null as unknown as ExactPair;
const _groupSurvives: { title: string } = null as unknown as GroupWithModeKeys;
void _pairCollapses;
void _groupSurvives;

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

  it("only collapses groups whose only keys are the two modes", () => {
    const wrongly: string[] = [];
    const walk = (raw: unknown, out: unknown, path: string) => {
      if (typeof raw !== "object" || raw === null) return;
      const keys = Object.keys(raw);
      const looksLikePair = keys.includes("normal") && keys.includes("finance");
      const collapsed = typeof out === "string";
      if (collapsed !== (looksLikePair && keys.length === 2)) wrongly.push(path);
      if (collapsed) return;
      for (const [k, v] of Object.entries(raw)) {
        walk(v, (out as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
      }
    };
    walk(catalog, strings("normal"), "");
    expect(wrongly).toEqual([]);
  });

  it("keeps the seven switchable terms mode-aware", () => {
    for (const key of Object.keys(catalog.terms)) {
      const pair = catalog.terms[key as keyof typeof catalog.terms];
      expect(pair.normal).not.toBe(pair.finance);
    }
  });
});
