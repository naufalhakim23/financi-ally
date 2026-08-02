import type {
  Account as DomainAccount,
  Budget as DomainBudget,
  Entry as DomainEntry,
  JournalLine as DomainLine,
} from "@financially/domain/types";

import type { Account, BudgetWithSpent, Entry, FxRateList, JournalLine } from "./api";

// Contract (snake_case, ISO strings) → domain records (camelCase).
//
// This is the whole cost of sharing the money logic with a mobile app whose
// store happens to be camelCase: one file, no behavior. Doing it here rather
// than reshaping the domain means neither client bends to the other's storage
// layer, and the contract stays the single source of truth for the wire.

export function toDomainAccount(a: Account): DomainAccount {
  return {
    id: a.id,
    type: a.type,
    currency: a.currency,
    name: a.name,
    archived: a.archived,
  };
}

export function toDomainEntry(e: Entry): DomainEntry {
  return {
    id: e.id,
    txnDate: e.txn_date,
    currency: e.currency,
    memo: e.memo,
  };
}

export function toDomainLine(l: JournalLine): DomainLine {
  return {
    id: l.id,
    entryId: l.entry_id,
    accountId: l.account_id,
    dc: l.dc,
    amountMinor: l.amount_minor,
    currency: l.currency,
  };
}

export function toDomainBudget(b: BudgetWithSpent): DomainBudget {
  return {
    id: b.id,
    accountId: b.account_id,
    periodMonth: b.period_month,
    targetMinor: b.target_minor,
    currency: b.currency,
  };
}

/** Every line of every entry, flattened — what the balance walkers expect. */
export function linesOf(entries: Entry[]): DomainLine[] {
  return entries.flatMap((e) => e.lines.map(toDomainLine));
}

/**
 * The rate table the domain's fx module reads.
 *
 * `rate` stays a string all the way through: the domain parses it at the point
 * of conversion, so no intermediate float rounding creeps in here.
 */
export function toRateTable(list: FxRateList | undefined) {
  return {
    rates: list?.rates.map((r) => ({ base: r.base, quote: r.quote, rate: r.rate })) ?? [],
    asOf: list?.as_of ?? null,
  };
}
