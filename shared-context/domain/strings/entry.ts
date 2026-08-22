import { terms } from "./terms";

export const entry = {
  new: {
    title: terms.addEntry,
    // A posted entry is immutable server-side, so "editing" one deletes it and
    // posts a replacement. The screen is the same; only the wording changes.
    editTitle: "Edit entry",
    save: "Save",
    saveAction: "Save transaction",
    saveChanges: "Save changes",
    modes: { out: "Out", in: "In", move: "Move" },
    from: "from",
    outOf: terms.outOf,
    into: terms.into,
    choose: "Choose",

    note: "Note",
    noteAdded: "Note added",
    notePlaceholder: "What was this for?",

    // Names the pocket before Save is reachable, so a remembered default can
    // never post somewhere unseen.
    summary: {
      from: (pocket: string) => `from ${pocket}`,
      noPocket: "Pick a pocket",
      hasNote: "note",
      expand: "Change pocket, date or note",
    },

    newCategory: "New category",
    newCategoryPlaceholder: "Groceries, rent, transport…",
    addCategory: "Add category",
    addCategoryFailed: "That category didn't save. Try again",
    railNew: "New",
    railCategory: (name: string) => `Category ${name}`,

    pickFrom: "Where from",
    pickTo: "Where to",
    // Both legs of an entry post in one currency, so choosing one side rules
    // the other side's mismatched accounts out. Said, rather than left to look
    // like the accounts went missing.
    hiddenByCurrency: (count: number, currency: string) =>
      `${count === 1 ? "1 account is" : `${count} accounts are`} hidden: both sides of an entry have to be in ${currency}.`,

    pocketLeft: (balance: string) => `${balance} left`,
    categorySpent: (spent: string) => `${spent} this month`,
    categoryOfTarget: (spent: string, target: string) => `${spent} of ${target} this month`,

    convertedAt: (amount: string, currency: string) =>
      `≈ ${amount} ${currency} · converted at today's rate`,

    errors: {
      pickBoth: (mode: "in" | "out" | "move") =>
        `Pick where the money comes ${mode === "in" ? "from" : "out of"} and where it goes`,
      sameAccount: "Pick two different accounts",
      badAmount: "Enter a valid amount",
      zeroAmount: "Enter an amount above zero",
      saveFailed: "That didn't save. Try again",
    },

    need: {
      pocket: {
        title: "Set up a pocket first",
        body: "A pocket is a bank account, cash, an e-wallet, or a card. Money has to come out of one.",
        action: "Create a pocket",
      },
      expense: {
        title: "Add a category first",
        body: "Spending lands in a category — groceries, rent, transport. Setup can create a starter set.",
        action: "Set up categories",
      },
      income: {
        title: "Add an income source first",
        body: "Money coming in needs a source: a salary, freelance work, a gift.",
        action: "Set up income",
      },
    },
  },

  detail: {
    title: "Entry",
    fallbackName: "Entry",
    // No time: txn_date round-trips through a server DATE column, so a clock
    // reading here would be invented precision.
    when: (date: string, space: string) => `${date} · ${space}`,
    note: "note",

    notFound: { title: "Entry not found", body: "It may have been deleted." },

    twoSides: "the two sides",
    balanced: "balanced",
    twoSidesWhy: "shown because wording is set to finance",
    balanceAfter: "balance after this entry",

    edit: "Edit",
    duplicate: "Duplicate",

    confirmDelete: {
      title: "Delete this entry?",
      body: "Both sides of the entry are removed. This cannot be undone.",
    },
  },

  row: {
    fallbackTitle: "Entry",
    unsynced: "unsynced",
    flow: (from: string, to: string, move: boolean) => `${from} → ${to}${move ? " · move" : ""}`,
    runningBalance: (balance: string) => `bal ${balance}`,
  },

  direction: {
    all: "All",
    in: "Money in",
    out: "Money out",
    move: "Moves",
  },
};
