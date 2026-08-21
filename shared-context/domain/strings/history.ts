export const history = {
  closeSearch: "Close search",
  searchEntries: "Search entries",
  filtersOn: "Filters on",
  searchPlaceholder: "Memo, pocket or amount",

  tabs: { months: "Months", entries: "All entries" },
  inVsOut: (year: number) => `in vs out · ${year}`,
  legendIn: "in",
  legendOut: "out",

  monthSubtitle: (income: string, expense: string, count: string) =>
    `in ${income} · out ${expense} · ${count}`,
  monthClosing: (balance: string) => `end ${balance}`,

  empty: {
    title: "Nothing logged yet",
    body: "Your first coffee, bus ticket, anything. Log it and this fills in.",
  },
  noMatches: {
    title: "Nothing matches",
    body: "Try a different word, or clear the filters.",
  },

  filterSheet: {
    title: "Filter entries",
    direction: "direction",
    pocket: "pocket",
    show: (count: string) => `Show ${count}`,
  },
};
