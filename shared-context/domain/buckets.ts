import type { Account, Budget, JournalLine } from "./types";
import { accountSigned } from "./balances";
import { convert, type RateTable } from "./fx";

// Direction 2a replaces the flat pockets list with four fixed buckets. They are
// derived, not stored: the shape falls out of `type` + `currency` that accounts
// already carry, so there is no migration and no column to keep in sync.
//
//   cash      asset accounts held in the base currency
//   foreign   asset accounts in any other currency
//   spending  expense categories, paired with this month's budget
//   owed      liabilities
//
// Slots come from the chart ramp so a bucket's icon tile reads the same color
// wherever it appears (DESIGN.md → Charts, fixed slot assignment).

export type BucketId = "cash" | "foreign" | "spending" | "owed";

export type BucketChild = {
  account: Account;
  /** Signed balance in the child's own currency. */
  balance: number;
  /** Same balance in the base currency, or null when no rate path exists. */
  base: number | null;
};

export type Bucket = {
  id: BucketId;
  /** Plain-wording title. Finance wording maps in src/lib/wording.ts. */
  title: string;
  subtitle: string;
  slot: number;
  /** Total in the base currency. Null when a child could not be converted. */
  total: number | null;
  /** True when the total leans on converted figures — the row says so. */
  converted: boolean;
  children: BucketChild[];
};

/** Slot per bucket — fixed, matching the hi-fi tiles. */
export const BUCKET_SLOT: Record<BucketId, number> = {
  cash: 0,
  spending: 1,
  foreign: 3,
  owed: 7,
};

function childOf(account: Account, lines: JournalLine[], base: string, rates: RateTable): BucketChild {
  const balance = accountSigned(account, lines);
  return {
    account,
    balance,
    base: account.currency === base ? balance : convert(balance, account.currency, base, rates),
  };
}

/** Sum children in base currency; null as soon as one child is unconvertible. */
function totalOf(children: BucketChild[]): number | null {
  let sum = 0;
  for (const c of children) {
    if (c.base == null) return null;
    sum += c.base;
  }
  return sum;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export type SpendingRow = {
  account: Account;
  spent: number;
  target: number | null;
  currency: string;
};

/**
 * The four buckets, in display order. `spendingRows` is passed separately
 * because spending is measured over a period rather than as a balance.
 */
export function buildBuckets(
  accounts: Account[],
  lines: JournalLine[],
  base: string,
  rates: RateTable,
  spendingRows: SpendingRow[],
): Bucket[] {
  const active = accounts.filter((a) => !a.archived);

  const cashChildren = active
    .filter((a) => a.type === "asset" && a.currency === base)
    .map((a) => childOf(a, lines, base, rates));

  const foreignChildren = active
    .filter((a) => a.type === "asset" && a.currency !== base)
    .map((a) => childOf(a, lines, base, rates));

  const owedChildren = active
    .filter((a) => a.type === "liability")
    .map((a) => childOf(a, lines, base, rates));

  const spent = spendingRows.reduce((s, r) => s + r.spent, 0);

  return [
    {
      id: "cash",
      title: "Cash and banks",
      subtitle: plural(cashChildren.length, "account", "accounts"),
      slot: BUCKET_SLOT.cash,
      total: totalOf(cashChildren),
      converted: false,
      children: cashChildren,
    },
    {
      id: "foreign",
      title: "Foreign",
      subtitle: foreignChildren.length === 0 ? "no foreign accounts" : "converted at cached rate",
      slot: BUCKET_SLOT.foreign,
      total: totalOf(foreignChildren),
      converted: foreignChildren.length > 0,
      children: foreignChildren,
    },
    {
      id: "spending",
      title: "Spending",
      // Money in a subtitle is formatted by the screen, which knows the
      // currency scale; here the subtitle only counts.
      subtitle: plural(spendingRows.length, "category", "categories"),
      slot: BUCKET_SLOT.spending,
      total: spent,
      converted: false,
      children: [],
    },
    {
      id: "owed",
      title: "Owed",
      subtitle: plural(owedChildren.length, "card or loan", "cards and loans"),
      slot: BUCKET_SLOT.owed,
      // A liability reads as money out, so it carries its own sign on screen.
      total: (() => {
        const t = totalOf(owedChildren);
        // `-0` is a real JS value and would reach a formatter as "-0".
        return t == null ? null : t === 0 ? 0 : -t;
      })(),
      converted: false,
      children: owedChildren,
    },
  ];
}

/**
 * Safe to spend — what is left of this month's plan.
 *
 * Defined as `Σ budget targets − Σ spent`, floored at zero. It stands in for a
 * budget screen (direction 2a folds budgets into Buckets), so it deliberately
 * ignores un-budgeted categories: the figure answers "how much of the plan is
 * left", not "how much money exists".
 */
export function safeToSpend(rows: SpendingRow[]): number {
  const planned = rows.reduce((s, r) => s + (r.target ?? 0), 0);
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  return Math.max(0, planned - spent);
}

/** Days remaining in the month containing `now`, inclusive of today. */
export function daysLeftInMonth(now = new Date()): number {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return end.getDate() - now.getDate() + 1;
}

function inPeriod(b: Budget, monthStart: Date): boolean {
  const p = new Date(b.periodMonth);
  return p.getFullYear() === monthStart.getFullYear() && p.getMonth() === monthStart.getMonth();
}

/**
 * Spending rows for a month, from local ledger data + that month's budgets.
 * `monthStart` is needed because budgets are per period — matching on account
 * alone lets last month's target inflate this month's safe-to-spend.
 */
export function spendingForMonth(
  accounts: Account[],
  lines: JournalLine[],
  entryIdsInMonth: Set<string>,
  budgets: Budget[],
  base: string,
  monthStart: Date,
): SpendingRow[] {
  return accounts
    .filter((a) => a.type === "expense" && !a.archived)
    .map((a) => {
      const spent = lines
        .filter((l) => l.accountId === a.id && l.dc === "debit" && entryIdsInMonth.has(l.entryId))
        .reduce((s, l) => s + l.amountMinor, 0);
      const budget = budgets.find((b) => b.accountId === a.id && inPeriod(b, monthStart));
      return { account: a, spent, target: budget?.targetMinor ?? null, currency: budget?.currency ?? base };
    })
    .filter((r) => r.spent > 0 || r.target != null)
    .sort((x, y) => y.spent - x.spent);
}
