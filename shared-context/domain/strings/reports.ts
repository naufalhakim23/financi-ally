import { terms } from "./terms";

export const reports = {
  title: "Reports",
  backLabel: "More",
  loadFailed: "Couldn't load your reports",

  netWorth: terms.totalMoney,
  assets: { normal: "What you have", finance: "Assets" },
  liabilities: { normal: "What you owe", finance: "Liabilities" },
  monthlySpend: "Monthly spend",
  cashFlow: { normal: "Money in and out", finance: "Cash flow" },
  income: { normal: "In", finance: "Income" },
  expenses: { normal: "Out", finance: "Expenses" },
  net: "Net",
  spendingByCategory: "Spending by category",
  total: "Total",

  /** Everything past the chart ramp, folded into one slice. */
  otherSlice: "Everything else",
  otherSliceCount: (n: number) => `${n} categories`,

  /** `Net worth · IDR` — the figure's unit, said once above it. */
  withCurrency: (label: string, currency: string) => `${label} · ${currency}`,

  empty: {
    title: "Nothing to report yet",
    body: "Log an expense and this month's breakdown shows up here.",
    action: "Add an entry",
  },
};
