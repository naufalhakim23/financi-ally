// Wording mode — the vocabulary half, shared by both clients.
//
// The same data and the same screens; only the words move between plain
// English and ledger English. Double-entry is a mode here, not a default — see
// the 31 Jul 2026 design-system changelog.
//
// The words themselves now live in the string catalog (`strings/terms.ts`),
// where mode is a dimension of every string rather than a seven-term special
// case. What stays here is the mode type and the `term()` / `TERM_ROWS` surface:
// the Wording settings screen teaches the mapping as a table, and the web client
// still reads terms one at a time. Each client owns its own provider, because
// persistence differs (WatermelonDB localStorage on mobile, localStorage on web)
// and a React context is not shareable across React Native and the DOM.

import { terms as TERMS } from "./strings/terms";

export type Wording = "normal" | "finance";

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
