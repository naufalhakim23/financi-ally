export const recurring = {
  title: "Repeating entries",
  backLabel: "More",
  loadFailed: "Couldn't load your repeating entries",
  deleteFailed: "That didn't delete. Try again",
  runFailed: "Couldn't run them just now. Try again",

  scheduled: "Scheduled",
  activeCount: (n: number) => `${n} active`,
  postsAutomatically: "entries post automatically on their date",
  running: "Running…",
  runDue: "Run due now",
  posted: (n: number) => `Posted ${n} ${n === 1 ? "entry" : "entries"}`,
  nothingDue: "Nothing due right now",

  empty: {
    title: "Nothing recurring yet",
    body: "Add rent, a subscription, or salary and it posts itself on schedule.",
  },

  ruleFrom: (schedule: string, pocket: string) => `${schedule} · from ${pocket}`,
  nextRun: (date: string) => `next ${date}`,
  paused: "Paused",
  lastRunFailed: (reason: string) => `Last run failed: ${reason}`,

  newRule: "New recurring",
  editRule: "Edit recurring",
  howOften: "How often",
  freq: { daily: "Daily", weekly: "Weekly", monthly: "Monthly" },
  on: "On",
  dayOfMonth: "Day of month",
  category: "Category",
  payFrom: "Pay from",
  amount: "Amount",
  memo: "Memo",
  memoPlaceholder: "Rent",

  form: {
    noCategory: "Select a category",
    noPocket: "Select a pocket to pay from",
    currencyMismatch: "Category and pocket must use the same currency",
    badAmount: "Enter a valid amount",
    zeroAmount: "Enter an amount above zero",
    saveFailed: "That didn't save. Try again",
  },

  confirmDelete: {
    title: "Delete this rule?",
    body: (name: string) =>
      `"${name}" stops posting. Entries it already created stay in the ledger.`,
    fallbackName: "This rule",
  },
};
