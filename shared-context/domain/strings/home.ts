export const home = {
  // One line above the hero. A status line replaces it when something needs
  // attention — the greeting is never the more important thing on the screen.
  greeting: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
  },
  status: {
    offline: "Working offline. Everything you log is saved here.",
    staleRates: "Rates haven't refreshed today. Converted figures may be off.",
  },

  bookSwitcher: (name: string) => `Book: ${name}. Change book`,
  search: "Search",
  offline: "offline",
  changeThisMonth: (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% this month`,
  manage: "Manage",
  rateUnavailable: "rate unavailable",
  daysLeft: (days: number, month: string) => `${days} days left in ${month}`,
  planLabel: "the plan this month",
  seeAll: "See all",
  planProgress: (spent: string, target: string) => `${spent} of ${target}`,

  quick: {
    plan: "The plan",
    reports: "Reports",
    repeating: "Repeating",
  },

  firstRun: {
    title: "Set up your money",
    body: "Pick the pockets you keep money in and the things you spend it on. Takes a minute.",
    action: "Get started",
  },
};
