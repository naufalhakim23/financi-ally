import type { Account, Entry, JournalLine } from "./types";

// View models for the history screens. Every entry in this app is a balanced
// pair of lines; these helpers turn that pair back into the plain-wording shape
// the screens speak — "out of X, into Y" — plus the running balance that makes
// a list of entries read as a ledger.

export type Direction = "out" | "in" | "move";

export type EntryView = {
  entry: Entry;
  direction: Direction;
  /** Where the money left (credit side). */
  from: Account | null;
  /** Where the money landed (debit side). */
  to: Account | null;
  amountMinor: number;
  currency: string;
  /** Balance of the asset/liability account this entry touched, after it. */
  runningBalance: number | null;
  runningCurrency: string | null;
};

const MONEY_TYPES = new Set(["asset", "liability"]);

function directionOf(from: Account | null, to: Account | null): Direction {
  if (to && MONEY_TYPES.has(to.type) && from && MONEY_TYPES.has(from.type)) return "move";
  if (from && from.type === "income") return "in";
  if (to && to.type === "expense") return "out";
  // Anything else (equity openings, adjustments) reads by where it landed.
  return to && MONEY_TYPES.has(to.type) ? "in" : "out";
}

/**
 * Entries as rows, newest first, each carrying the running balance of the money
 * account it touched.
 *
 * The balance is walked forward from the oldest entry so every row shows the
 * balance *after* itself, then the list is reversed for display — the same
 * order the hi-fi shows and the only order in which a running figure means
 * anything.
 */
export function buildEntryViews(
  entries: Entry[],
  lines: JournalLine[],
  accounts: Account[],
): EntryView[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const linesByEntry = new Map<string, JournalLine[]>();
  for (const l of lines) {
    const list = linesByEntry.get(l.entryId);
    if (list) list.push(l);
    else linesByEntry.set(l.entryId, [l]);
  }

  const oldestFirst = [...entries].sort(
    (a, b) => new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime(),
  );

  const balances = new Map<string, number>();
  const views: EntryView[] = [];

  for (const entry of oldestFirst) {
    const own = linesByEntry.get(entry.id) ?? [];
    const debit = own.find((l) => l.dc === "debit") ?? null;
    const credit = own.find((l) => l.dc === "credit") ?? null;
    const to = debit ? (byId.get(debit.accountId) ?? null) : null;
    const from = credit ? (byId.get(credit.accountId) ?? null) : null;

    // Apply every line so the running figure stays correct even for entries
    // this view does not itself render (a transfer touches two money accounts).
    for (const l of own) {
      const acct = byId.get(l.accountId);
      if (!acct || !MONEY_TYPES.has(acct.type)) continue;
      const debitNormal = acct.type === "asset";
      const delta = (l.dc === "debit") === debitNormal ? l.amountMinor : -l.amountMinor;
      balances.set(acct.id, (balances.get(acct.id) ?? 0) + delta);
    }

    // The row's running figure follows the money account it moved — the credit
    // side for spending, the debit side for income.
    const anchor =
      from && MONEY_TYPES.has(from.type) ? from : to && MONEY_TYPES.has(to.type) ? to : null;

    views.push({
      entry,
      direction: directionOf(from, to),
      from,
      to,
      amountMinor: debit?.amountMinor ?? credit?.amountMinor ?? 0,
      currency: debit?.currency ?? entry.currency,
      runningBalance: anchor ? (balances.get(anchor.id) ?? 0) : null,
      runningCurrency: anchor?.currency ?? null,
    });
  }

  return views.reverse();
}

export type DayGroup = { key: string; label: string; net: number; currency: string; rows: EntryView[] };

/** Signed contribution of a row to a day/month total: out is negative. */
export function signedAmount(v: EntryView): number {
  if (v.direction === "in") return v.amountMinor;
  if (v.direction === "out") return -v.amountMinor;
  return 0; // a move is not income or spending — it nets to nothing
}

/** Group rows by calendar day, newest day first. Rows arrive newest-first. */
export function groupByDay(views: EntryView[], base: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const v of views) {
    const d = new Date(v.entry.txnDate);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = {
        key,
        label: d.toLocaleDateString(undefined, { day: "numeric", month: "long" }),
        net: 0,
        currency: base,
        rows: [],
      };
      groups.push(group);
    }
    group.rows.push(v);
    group.net += signedAmount(v);
  }
  return groups;
}

/** `2026-07` — the key month screens route on. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** `2026-08` as a person says it. Drop the year where the screen implies it. */
export function monthLabel(key: string, { year = true }: { year?: boolean } = {}): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    ...(year ? { year: "numeric" as const } : {}),
  });
}

/** Rows falling inside the given `YYYY-MM`. */
export function viewsInMonth(views: EntryView[], key: string): EntryView[] {
  return views.filter((v) => monthKey(new Date(v.entry.txnDate)) === key);
}

/** RFC 4180: quote every field, double any embedded quote. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * A set of entries as CSV, newest-first as given.
 *
 * Amounts stay signed and in minor units, in the entry's own currency: a
 * spreadsheet can scale those, whereas a locale-formatted string it cannot
 * parse back is worse than useless.
 */
export function monthCsv(views: EntryView[]): string {
  const header = ["date", "description", "out of", "into", "amount_minor", "currency"];
  const rows = views.map((v) =>
    [
      new Date(v.entry.txnDate).toISOString().slice(0, 10),
      v.entry.memo || v.to?.name || "",
      v.from?.name ?? "",
      v.to?.name ?? "",
      String(signedAmount(v)),
      v.currency,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...rows].join("\n");
}
