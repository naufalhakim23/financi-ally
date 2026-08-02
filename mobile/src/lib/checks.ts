// Self-check for the pure logic behind the direction-2a screens: FX conversion,
// the ledger walk, bucket grouping, and keypad arithmetic. Run it with
// `npm run check` — no test framework, no runtime dependency, just assertions.
//
// Deliberately narrow: it covers the arithmetic that would otherwise be wrong
// silently. Rendering is verified by looking at the app.

function ok(condition: boolean, what: string): void {
  if (!condition) throw new Error(`check failed: ${what}`);
}

const assert = {
  ok,
  equal: (a: unknown, b: unknown, what: string) =>
    ok(a === b, `${what} (got ${String(a)}, wanted ${String(b)})`),
  deepEqual: (a: unknown, b: unknown, what: string) =>
    ok(JSON.stringify(a) === JSON.stringify(b), `${what} (got ${JSON.stringify(a)})`),
};

import { convert, rateCaption, rateFor, type RateTable } from "./fx";
import { buildEntryViews, groupByDay, monthCsv, monthKey, signedAmount } from "./ledger";
import { buildBuckets, daysLeftInMonth, safeToSpend, spendingForMonth } from "./buckets";
import { applyKey } from "./keypad";

// ── fx ──────────────────────────────────────────────────────────────────────

const rates: RateTable = {
  rates: [
    { base: "USD", quote: "IDR", rate: "16284" },
    { base: "USD", quote: "SGD", rate: "1.35" },
  ],
  asOf: "2026-07-31T00:00:00Z",
};

assert.equal(rateFor("USD", "IDR", rates), 16284, "direct rate");
assert.equal(rateFor("IDR", "IDR", rates), 1, "identity rate");
assert.ok(Math.abs((rateFor("IDR", "USD", rates) ?? 0) - 1 / 16284) < 1e-12, "inverted rate");
assert.equal(rateFor("EUR", "IDR", rates), null, "missing path stays null");

// USD has two decimals, IDR none: $100.00 (10000 minor) → Rp 1,628,400 (minor).
assert.equal(convert(10_000, "USD", "IDR", rates), 1_628_400, "scale-aware conversion");
// And back, losing nothing meaningful.
assert.equal(convert(1_628_400, "IDR", "USD", rates), 10_000, "round trip");
assert.equal(convert(1, "EUR", "IDR", rates), null, "no rate → no number");

assert.ok(
  rateCaption("USD", "IDR", rates)?.startsWith("1 USD = 16,284 IDR") ?? false,
  "rate caption",
);
assert.equal(rateCaption("EUR", "IDR", rates), null, "no caption without a rate");

// ── ledger ──────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
const account = (id: string, type: string, name: string, currency = "IDR"): Row => ({
  id,
  type,
  name,
  currency,
  archived: false,
});
const entry = (id: string, day: string, memo = ""): Row => ({
  id,
  txnDate: new Date(day),
  memo,
  currency: "IDR",
  status: "posted",
  source: "manual",
});
const line = (entryId: string, accountId: string, dc: string, amountMinor: number): Row => ({
  entryId,
  accountId,
  dc,
  amountMinor,
  currency: "IDR",
});

const accounts = [
  account("cash", "asset", "Cash"),
  account("bca", "asset", "BCA"),
  account("visa", "liability", "Visa"),
  account("groceries", "expense", "Groceries"),
  account("salary", "income", "Salary"),
  account("wise", "asset", "Wise USD", "USD"),
];

const entries = [
  entry("e1", "2026-07-01", "opening salary"),
  entry("e2", "2026-07-10", "market run"),
  entry("e3", "2026-07-20", "to savings"),
];
const lines = [
  // salary 1,000,000 into cash
  line("e1", "cash", "debit", 1_000_000),
  line("e1", "salary", "credit", 1_000_000),
  // spend 45,000 out of cash
  line("e2", "groceries", "debit", 45_000),
  line("e2", "cash", "credit", 45_000),
  // move 200,000 cash → bca
  line("e3", "bca", "debit", 200_000),
  line("e3", "cash", "credit", 200_000),
];

const views = buildEntryViews(entries as never, lines as never, accounts as never);

assert.equal(views.length, 3, "one view per entry");
assert.equal(views[0].entry.id, "e3", "newest first");
assert.deepEqual(
  views.map((v) => v.direction),
  ["move", "out", "in"],
  "direction from the account types on each side",
);

// Running balance follows the money account each row moved, after that row:
// e1 +1,000,000 → e2 −45,000 → e3 −200,000 leaves cash at 755,000.
const byEntry = Object.fromEntries(views.map((v) => [v.entry.id, v]));
assert.equal(byEntry.e1.runningBalance, 1_000_000, "balance after the salary");
assert.equal(byEntry.e2.runningBalance, 955_000, "balance after the spend");
assert.equal(byEntry.e3.runningBalance, 755_000, "balance after the move (credit side)");

// A move is neither income nor spending, so it nets to nothing.
assert.equal(signedAmount(byEntry.e3), 0, "a move nets to zero");
assert.equal(signedAmount(byEntry.e2), -45_000, "out is negative");
assert.equal(signedAmount(byEntry.e1), 1_000_000, "in is positive");

const days = groupByDay(views, "IDR");
assert.equal(days.length, 3, "three distinct days");
assert.equal(days[0].net, 0, "the move day nets to zero");
assert.equal(monthKey(new Date("2026-07-04")), "2026-07", "zero-padded month key");

// ── buckets ─────────────────────────────────────────────────────────────────

const budgets = [{ accountId: "groceries", targetMinor: 2_000_000, currency: "IDR" }];
const monthIds = new Set(["e1", "e2", "e3"]);
const spending = spendingForMonth(
  accounts as never,
  lines as never,
  monthIds,
  budgets as never,
  "IDR",
);
assert.equal(spending.length, 1, "only categories with spend or a target");
assert.equal(spending[0].spent, 45_000, "spend is the debit total");

const buckets = buildBuckets(accounts as never, lines as never, "IDR", rates, spending);
const cash = buckets.find((b) => b.id === "cash")!;
const foreign = buckets.find((b) => b.id === "foreign")!;
const owed = buckets.find((b) => b.id === "owed")!;

assert.deepEqual(
  cash.children.map((c) => c.account.id).sort(),
  ["bca", "cash"],
  "base-currency assets land in cash and banks",
);
assert.equal(cash.total, 955_000, "cash bucket totals its children");
assert.deepEqual(foreign.children.map((c) => c.account.id), ["wise"], "non-base assets are foreign");
assert.equal(foreign.converted, true, "a foreign bucket says it is converted");
assert.deepEqual(owed.children.map((c) => c.account.id), ["visa"], "liabilities are owed");
assert.equal(owed.total, 0, "an untouched card owes nothing");

// An unconvertible child must collapse the total rather than under-report it.
const noRates: RateTable = { rates: [], asOf: null };
const withEur = [...accounts, account("n26", "asset", "N26", "EUR")];
const eurLine = line("e4", "n26", "debit", 500);
const blind = buildBuckets(
  withEur as never,
  [...lines, eurLine] as never,
  "IDR",
  noRates,
  spending,
);
assert.equal(
  blind.find((b) => b.id === "foreign")!.total,
  null,
  "no rate path → no total, never a wrong one",
);

assert.equal(safeToSpend(spending), 1_955_000, "safe to spend is plan less spend");
assert.equal(safeToSpend([{ ...spending[0], spent: 9_000_000 }]), 0, "overspend floors at zero");
assert.equal(daysLeftInMonth(new Date(2026, 6, 31)), 1, "the last day still counts");
assert.equal(daysLeftInMonth(new Date(2026, 6, 1)), 31, "a full July");

// ── csv export ──────────────────────────────────────────────────────────────

const csv = monthCsv(views);
const csvLines = csv.split("\n");
assert.equal(
  csvLines[0],
  '"date","description","out of","into","amount_minor","currency"',
  "header names the columns a spreadsheet needs",
);
assert.equal(csvLines.length, views.length + 1, "one line per entry plus the header");
assert.ok(
  csvLines.slice(1).every((l) => l.split('","').length === 6),
  "every row has six quoted fields",
);
assert.equal(
  monthCsv([]),
  '"date","description","out of","into","amount_minor","currency"',
  "an empty month is a header and nothing else",
);
assert.ok(
  csv.includes('"-45000"') || csv.includes('"45000"'),
  "amounts stay signed minor units, not a formatted string",
);

// ── keypad ──────────────────────────────────────────────────────────────────

assert.equal(applyKey("", "4"), "4", "first digit");
assert.equal(applyKey("0", "5"), "5", "a leading zero is replaced");
assert.equal(applyKey("45", "000"), "45000", "the triple appends three zeros");
assert.equal(applyKey("45", "back"), "4", "backspace");
assert.equal(applyKey("", "back"), "", "backspace on empty is a no-op");
assert.equal(applyKey("999999999999999", "9").length, 15, "capped before toMinor can overflow");

console.log("all checks passed");
