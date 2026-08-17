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
    title: "Nothing planned this month",
    body: "Give a category a monthly target and you'll see how much of it is left.",
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
    zeroAmount: "Enter an amount above zero",
    saveFailed: "That didn't save. Try again",
  },

  confirmDelete: {
    title: "Delete this budget?",
    body: (category: string) =>
      `${category} loses its monthly target. Spending already logged is not affected.`,
  },
};
