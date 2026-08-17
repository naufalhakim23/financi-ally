export const buckets = {
  newPocket: "New",
  space: "Personal",
  rateUnavailable: "rate unavailable",

  spending: "Spending",
  spendingPlanned: (spent: string, planned: string) => `${spent} of ${planned} planned`,
  spendingThisMonth: (spent: string) => `${spent} this month`,

  empty: {
    title: "No buckets yet",
    body: "Buckets group your accounts and categories. Setup builds you a starter set.",
    action: "Set up",
  },

  addTo: (name: string) => `Add to ${name}`,
  moveIn: (name: string) => `Move money in ${name}`,
};
