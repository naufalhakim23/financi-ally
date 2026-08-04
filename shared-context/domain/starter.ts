// The starter chart of accounts a first-run wizard offers.
//
// Data, not I/O: each client writes it its own way (web POSTs /accounts, mobile
// writes WatermelonDB so guest mode never needs a server), but both must offer
// the same list or the same person signing up twice gets two different ledgers.
//
// Every account is created in the ledger's base currency. A mismatched pair is
// unpostable until the entry screens collect an fx rate, so a starter chart is
// the wrong place to introduce a second currency.

import type { AccountType } from "./types";

export type StarterItem = {
  /** Unique across the whole catalog, so a selection is a flat set of names. */
  name: string;
  type: AccountType;
  checked: boolean;
};

export type StarterStep = {
  key: "pockets" | "categories" | "income";
  title: string;
  hint: string;
  items: StarterItem[];
};

const pocket = (name: string, checked = false): StarterItem => ({ name, type: "asset", checked });
const category = (name: string, checked = false): StarterItem => ({
  name,
  type: "expense",
  checked,
});
const source = (name: string, checked = false): StarterItem => ({ name, type: "income", checked });

export const STARTER_STEPS: StarterStep[] = [
  {
    key: "pockets",
    title: "Where does your money sit?",
    hint: "Pick the ones you use. You can add or remove any later.",
    items: [
      pocket("Cash", true),
      pocket("Bank account", true),
      pocket("E-wallet"),
      pocket("Savings"),
      { name: "Credit card", type: "liability", checked: false },
    ],
  },
  {
    key: "categories",
    title: "What do you spend on?",
    hint: "These are the buckets your spending lands in.",
    // The four checked here are the four the old mobile onboarding seeded, so
    // nobody comparing against the previous flow loses a category.
    items: [
      category("Groceries", true),
      category("Rent", true),
      category("Transport", true),
      category("Dining", true),
      category("Bills"),
      category("Health"),
      category("Shopping"),
      category("Fun"),
    ],
  },
  {
    key: "income",
    title: "Where does money come from?",
    hint: "Without one of these you can record spending but not earning.",
    items: [source("Salary", true), source("Freelance"), source("Gift"), source("Other")],
  },
];

export const STARTER_ITEMS: StarterItem[] = STARTER_STEPS.flatMap((s) => s.items);

/** The names checked when the wizard opens. */
export function defaultSelection(): Set<string> {
  return new Set(STARTER_ITEMS.filter((i) => i.checked).map((i) => i.name));
}

/** The catalog entries a selection of names refers to, in catalog order. */
export function selectedItems(selection: Set<string>): StarterItem[] {
  return STARTER_ITEMS.filter((i) => selection.has(i.name));
}
