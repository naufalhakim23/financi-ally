// Wording mode — the vocabulary half, shared by both clients.
//
// The same data and the same screens; only the words move between plain
// English and ledger English. Double-entry is a mode here, not a default — see
// the 31 Jul 2026 design-system changelog.
//
// Only the mapping lives here. Each client owns its own provider, because
// persistence differs (WatermelonDB localStorage on mobile, localStorage on
// web) and a React context is not shareable across React Native and the DOM.

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
