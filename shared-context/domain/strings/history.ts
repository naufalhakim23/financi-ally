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
    title: "No entries yet",
    body: "Every money move you log shows up here, newest first.",
  },
  noMatches: {
    title: "No matches",
    body: "Nothing here fits the search and filters.",
  },

  filterSheet: {
    title: "Filter entries",
    direction: "direction",
    pocket: "pocket",
    show: (count: string) => `Show ${count}`,
  },
};
