export const setup = {
  step: (n: number, total: number) => `Step ${n} of ${total}`,
  owedSuffix: (name: string) => `${name} (you owe this)`,
  createdIn: (currency: string) => `All created in ${currency}, your base currency`,
  failed: "Couldn't create your accounts",

  checklist: {
    title: "Finish setting up",
    dismiss: "Dismiss setup checklist",
    progress: (done: number, total: number) => `${done} of ${total}`,
    add: "Add",
    items: {
      pocket: { label: "Add a pocket", hint: "cash, bank, e-wallet" },
      category: { label: "Add a category", hint: "what you spend on" },
      income: { label: "Add an income source", hint: "where money comes from" },
      entry: { label: "Record your first entry", hint: "and the numbers start moving" },
    },
  },

  pocket: {
    title: "New pocket",
    kind: "Kind",
    hold: "I hold this",
    owe: "I owe this",
    name: "Name",
    namePlaceholder: "BCA Checking",
    currency: "Currency",
    openingBalance: "Opening balance (optional)",
    amountOwed: "Amount owed (optional)",
    create: "Create pocket",
    openingMemo: (name: string) => `Opening balance · ${name}`,

    noName: "Give the pocket a name",
    badCurrency: "Currency must be a 3-letter code (e.g. IDR)",
    badOpening: "Enter a valid opening balance",
    failed: "That pocket didn't save. Try again",
  },
};
