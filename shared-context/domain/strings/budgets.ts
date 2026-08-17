import { monthLabel } from "../ledger";

export const budgets = {
  title: "The spending plan",
  backLabel: "More",
  loadFailed: "Couldn't load the spending plan",
  deleteFailed: "Couldn't delete that budget",

  totalSpent: "Total spent",
  budget: "Budget",
  used: (pct: number) => `${pct}% used`,
  /** The period a plan covers, from a `YYYY-MM-DD` month start. */
  periodTitle: (period: string) => monthLabel(period.slice(0, 7), { year: false }),
  spentOfTarget: (currency: string, spent: string, target: string) =>
    `${currency} ${spent} / ${target}`,
  categoryPct: (pct: number) => `${pct}%`,

  empty: {
    title: "No budgets this month",
    body: "Set a monthly target on a category to see spent-vs-target here.",
  },

  setBudget: "Set budget",
  editTargets: "Edit targets",
  editBudget: "Edit budget",
  category: "Category",
  everyCategoryBudgeted: "Every category already has a budget",
  monthlyTarget: "Monthly target",

  form: {
    noCategory: "Select a category",
    noAmount: "Enter a budget amount",
    badAmount: "Enter a valid amount",
    zeroAmount: "Amount must be greater than zero",
    saveFailed: "save failed",
  },

  confirmDelete: {
    title: "Delete this budget?",
    body: (category: string) =>
      `${category} loses its monthly target. Spending already logged is not affected.`,
  },
};
