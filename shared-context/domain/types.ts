// The plain records the domain functions read.
//
// Deliberately NOT the generated contract types: the contract is snake_case
// with ISO date strings, while mobile's WatermelonDB models are camelCase with
// real Dates. These declare the intersection both can satisfy — a WMDB model
// instance matches structurally (its decorators expose exactly these names), and
// the web client maps a contract response onto them once, in one adapter.
//
// Date fields accept `Date | string` for the same reason: `new Date(x)` is
// correct for both, so neither client has to normalize before calling in.

export type AccountType = "asset" | "liability" | "income" | "expense" | "equity";

export type DC = "debit" | "credit";

export type Account = {
  id: string;
  type: string;
  currency: string;
  name: string;
  archived: boolean;
};

export type Entry = {
  id: string;
  txnDate: Date | string;
  currency: string;
  memo: string;
};

export type JournalLine = {
  id: string;
  entryId: string;
  accountId: string;
  dc: DC;
  amountMinor: number;
  currency: string;
};

export type Budget = {
  id: string;
  accountId: string;
  periodMonth: Date | string;
  targetMinor: number;
  currency: string;
};
