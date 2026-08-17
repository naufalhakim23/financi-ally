// The seven words the wording switch was built around, and the ones the Wording
// settings screen shows side by side. They live here rather than in wording.ts
// so the catalog owns every user-facing string exactly once; wording.ts reads
// them back out to keep `term()` and `TERM_ROWS` working for the web client.

export const terms = {
  totalMoney: { normal: "Total money", finance: "Net worth" },
  history: { normal: "History", finance: "Journal" },
  buckets: { normal: "Buckets", finance: "Accounts" },
  addEntry: { normal: "Add money move", finance: "New entry" },
  outOf: { normal: "Out of", finance: "Credit" },
  into: { normal: "Into", finance: "Debit" },
  safeToSpend: { normal: "Safe to spend", finance: "Unallocated" },
};
