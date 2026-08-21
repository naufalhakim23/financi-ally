// The seven words the wording switch was built around. wording.ts reads them
// back out for `term()` and `TERM_ROWS`.

export const terms = {
  totalMoney: { normal: "Total money", finance: "Net worth" },
  history: { normal: "History", finance: "Journal" },
  buckets: { normal: "Buckets", finance: "Accounts" },
  addEntry: { normal: "Add money move", finance: "New entry" },
  outOf: { normal: "Out of", finance: "Credit" },
  into: { normal: "Into", finance: "Debit" },
  safeToSpend: { normal: "Safe to spend", finance: "Unallocated" },
};
