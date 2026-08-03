// The money math both clients run. Ported from mobile/src/lib/checks.ts when
// these modules moved here, plus coverage for money.ts itself, the conversion
// that every amount on every screen passes through and that had no test.
//
// Deliberately narrow: it covers arithmetic that would otherwise be wrong
// silently. Rendering is verified by looking at the apps.

import { describe, expect, it } from "vitest";

import { accountSigned } from "./balances";
import { buildBuckets, daysLeftInMonth, safeToSpend, spendingForMonth } from "./buckets";
import { convert, rateCaption, rateFor, type RateTable } from "./fx";
import { buildEntryViews, groupByDay, monthCsv, monthKey, signedAmount } from "./ledger";
import { format, scale, toMinor } from "./money";
import { MAX_MONTH_DAY, buildRRule, describeRRule, ordinal, parseRRule } from "./recurrence";
import type { Account, Budget, Entry, JournalLine } from "./types";

// ── fixtures ────────────────────────────────────────────────────────────────

const rates: RateTable = {
  rates: [
    { base: "USD", quote: "IDR", rate: "16284" },
    { base: "USD", quote: "SGD", rate: "1.35" },
  ],
  asOf: "2026-07-31T00:00:00Z",
};

const account = (id: string, type: string, name: string, currency = "IDR"): Account => ({
  id,
  type,
  name,
  currency,
  archived: false,
});

const entry = (id: string, day: string, memo = ""): Entry => ({
  id,
  txnDate: new Date(day),
  memo,
  currency: "IDR",
});

const line = (
  entryId: string,
  accountId: string,
  dc: "debit" | "credit",
  amountMinor: number,
): JournalLine => ({
  id: `${entryId}-${accountId}-${dc}`,
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

// ── money ───────────────────────────────────────────────────────────────────

describe("money", () => {
  it("knows each currency's scale", () => {
    expect(scale("IDR")).toBe(0);
    expect(scale("USD")).toBe(2);
    expect(scale("KWD")).toBe(3);
  });

  it("parses decimal input at the currency's scale", () => {
    expect(toMinor("USD", "50.00")).toBe(5000);
    expect(toMinor("USD", "50")).toBe(5000);
    expect(toMinor("USD", "50.5")).toBe(5050);
    expect(toMinor("IDR", "50000")).toBe(50_000);
    expect(toMinor("KWD", "1.234")).toBe(1234);
    expect(toMinor("USD", ".5")).toBe(50);
  });

  it("rejects what would silently lose money", () => {
    expect(() => toMinor("USD", "50.005")).toThrow(); // more precision than the currency has
    expect(() => toMinor("IDR", "50.5")).toThrow(); // IDR has no minor unit at all
    expect(() => toMinor("USD", "-5")).toThrow();
    expect(() => toMinor("USD", "1.2.3")).toThrow();
    expect(() => toMinor("USD", "abc")).toThrow();
    expect(() => toMinor("USD", "")).toThrow();
  });

  it("round-trips through format", () => {
    expect(format("USD", 5050)).toBe("50.50");
    expect(format("USD", 5)).toBe("0.05");
    expect(format("IDR", 50_000)).toBe("50000");
    expect(format("USD", -5050)).toBe("-50.50");
    expect(toMinor("USD", format("USD", 123_456))).toBe(123_456);
  });
});

// ── fx ──────────────────────────────────────────────────────────────────────

describe("fx", () => {
  it("resolves direct, identity, inverted and missing paths", () => {
    expect(rateFor("USD", "IDR", rates)).toBe(16284);
    expect(rateFor("IDR", "IDR", rates)).toBe(1);
    expect(rateFor("IDR", "USD", rates)).toBeCloseTo(1 / 16284, 12);
    expect(rateFor("EUR", "IDR", rates)).toBeNull();
  });

  it("converts across differing scales", () => {
    // USD has two decimals, IDR none: $100.00 → Rp 1,628,400.
    expect(convert(10_000, "USD", "IDR", rates)).toBe(1_628_400);
    expect(convert(1_628_400, "IDR", "USD", rates)).toBe(10_000);
  });

  it("returns null rather than a wrong number when no rate exists", () => {
    expect(convert(1, "EUR", "IDR", rates)).toBeNull();
    expect(rateCaption("EUR", "IDR", rates)).toBeNull();
  });

  it("captions the rate it used", () => {
    expect(rateCaption("USD", "IDR", rates)).toMatch(/^1 USD = 16,284 IDR/);
  });
});

// ── ledger ──────────────────────────────────────────────────────────────────

describe("ledger", () => {
  const views = buildEntryViews(entries, lines, accounts);
  const byEntry = Object.fromEntries(views.map((v) => [v.entry.id, v]));

  it("returns one view per entry, newest first", () => {
    expect(views).toHaveLength(3);
    expect(views[0].entry.id).toBe("e3");
  });

  it("reads direction from the account types on each side", () => {
    expect(views.map((v) => v.direction)).toEqual(["move", "out", "in"]);
  });

  it("walks the running balance forward, not backward", () => {
    // e1 +1,000,000 → e2 −45,000 → e3 −200,000 leaves cash at 755,000.
    expect(byEntry.e1.runningBalance).toBe(1_000_000);
    expect(byEntry.e2.runningBalance).toBe(955_000);
    expect(byEntry.e3.runningBalance).toBe(755_000);
  });

  it("treats a move as neither income nor spending", () => {
    expect(signedAmount(byEntry.e3)).toBe(0);
    expect(signedAmount(byEntry.e2)).toBe(-45_000);
    expect(signedAmount(byEntry.e1)).toBe(1_000_000);
  });

  it("groups by calendar day", () => {
    const days = groupByDay(views, "IDR");
    expect(days).toHaveLength(3);
    expect(days[0].net).toBe(0); // the move day
    expect(monthKey(new Date("2026-07-04"))).toBe("2026-07");
  });

  it("exports CSV a spreadsheet can parse back", () => {
    const header = '"date","description","out of","into","amount_minor","currency"';
    const csv = monthCsv(views);
    const csvLines = csv.split("\n");
    expect(csvLines[0]).toBe(header);
    expect(csvLines).toHaveLength(views.length + 1);
    expect(csvLines.slice(1).every((l) => l.split('","').length === 6)).toBe(true);
    expect(monthCsv([])).toBe(header);
    // Amounts stay signed minor units, never a locale-formatted string.
    expect(csv).toContain('"-45000"');
  });
});

// ── buckets ─────────────────────────────────────────────────────────────────

describe("buckets", () => {
  const july = new Date(2026, 6, 1);
  const budgets: Budget[] = [
    {
      id: "b1",
      accountId: "groceries",
      targetMinor: 2_000_000,
      currency: "IDR",
      periodMonth: july,
    },
  ];
  const monthIds = new Set(["e1", "e2", "e3"]);
  const spending = spendingForMonth(accounts, lines, monthIds, budgets, "IDR", july);

  it("keeps only categories with spend or a target", () => {
    expect(spending).toHaveLength(1);
    expect(spending[0].spent).toBe(45_000);
    expect(spending[0].target).toBe(2_000_000);
  });

  it("does not leak last month's target forward", () => {
    const august = new Date(2026, 7, 1);
    const stale = spendingForMonth(accounts, lines, monthIds, budgets, "IDR", august);
    expect(stale[0].target).toBeNull();
  });

  it("sorts accounts into the four buckets", () => {
    const buckets = buildBuckets(accounts, (a) => accountSigned(a, lines), "IDR", rates, spending);
    const cash = buckets.find((b) => b.id === "cash")!;
    const foreign = buckets.find((b) => b.id === "foreign")!;
    const owed = buckets.find((b) => b.id === "owed")!;

    expect(cash.children.map((c) => c.account.id).sort()).toEqual(["bca", "cash"]);
    expect(cash.total).toBe(955_000);
    expect(foreign.children.map((c) => c.account.id)).toEqual(["wise"]);
    expect(foreign.converted).toBe(true);
    expect(owed.children.map((c) => c.account.id)).toEqual(["visa"]);
    expect(owed.total).toBe(0);
  });

  it("collapses a total rather than under-reporting an unconvertible child", () => {
    const noRates: RateTable = { rates: [], asOf: null };
    const withEur = [...accounts, account("n26", "asset", "N26", "EUR")];
    const withEurLines = [...lines, line("e4", "n26", "debit", 500)];
    const blind = buildBuckets(
      withEur,
      (a) => accountSigned(a, withEurLines),
      "IDR",
      noRates,
      spending,
    );
    expect(blind.find((b) => b.id === "foreign")!.total).toBeNull();
  });

  it("floors safe-to-spend at zero", () => {
    expect(safeToSpend(spending)).toBe(1_955_000);
    expect(safeToSpend([{ ...spending[0], spent: 9_000_000 }])).toBe(0);
  });

  it("counts today as a day left", () => {
    expect(daysLeftInMonth(new Date(2026, 6, 31))).toBe(1);
    expect(daysLeftInMonth(new Date(2026, 6, 1))).toBe(31);
  });
});

describe("recurrence", () => {
  it("round-trips every frequency through build and parse", () => {
    for (const r of [
      { freq: "daily", monthDay: 1, weekDay: "MO" },
      { freq: "weekly", monthDay: 1, weekDay: "TH" },
      { freq: "monthly", monthDay: 15, weekDay: "MO" },
    ] as const) {
      expect(parseRRule(buildRRule(r))).toEqual(r);
    }
  });

  it("tolerates the RRULE: prefix and a missing day", () => {
    expect(parseRRule("RRULE:FREQ=MONTHLY").monthDay).toBe(1);
    expect(parseRRule("FREQ=WEEKLY").weekDay).toBe("MO");
  });

  it("describes a rule in the user's words", () => {
    expect(describeRRule("FREQ=DAILY")).toBe("Every day");
    expect(describeRRule("FREQ=WEEKLY;BYDAY=TH")).toBe("Every Thu");
    expect(describeRRule("FREQ=MONTHLY;BYMONTHDAY=1")).toBe("Monthly on the 1st");
    expect(describeRRule("FREQ=MONTHLY;BYMONTHDAY=22")).toBe("Monthly on the 22nd");
  });

  it("says 11th, 12th, 13th — not 11st, 12nd, 13rd", () => {
    expect([11, 12, 13].map(ordinal)).toEqual(["th", "th", "th"]);
    expect([1, 2, 3, 21].map(ordinal)).toEqual(["st", "nd", "rd", "st"]);
  });

  it("caps the day of month at one every month has", () => {
    // A rule on the 31st would skip February entirely, which reads to a user as
    // the app losing an entry.
    expect(MAX_MONTH_DAY).toBe(28);
  });
});
