import { describe, expect, it } from "vitest";

import {
  daysLoggedLastWeek,
  loggedEntries,
  momentFor,
  type MomentInput,
  type MomentKey,
} from "./moments";

// Nothing to acknowledge. Cases override only what they are about.
const QUIET: MomentInput = {
  entryCount: 40,
  daysLoggedLastWeek: 1,
  dayOfMonth: 8,
  daysLeftInMonth: 22,
  plannedMinor: 500_000,
  spentMinor: 900_000,
  safeToSpendMinor: -100_000,
};

describe("momentFor", () => {
  const cases: { name: string; input: Partial<MomentInput>; want: MomentKey | null }[] = [
    { name: "nothing worth saying", input: {}, want: null },

    { name: "the very first entry", input: { entryCount: 1 }, want: "firstEntry" },
    { name: "the second entry is not a moment", input: { entryCount: 2 }, want: null },
    {
      name: "a first entry outranks every other moment",
      input: { entryCount: 1, daysLoggedLastWeek: 7, dayOfMonth: 14, safeToSpendMinor: 1 },
      want: "firstEntry",
    },

    { name: "a full week of logging", input: { daysLoggedLastWeek: 7 }, want: "weekOfLogging" },
    { name: "six days is not a week", input: { daysLoggedLastWeek: 6 }, want: null },

    {
      name: "under the plan at month end",
      input: { daysLeftInMonth: 2, spentMinor: 400_000 },
      want: "underBudget",
    },
    {
      name: "over the plan at month end says nothing",
      input: { daysLeftInMonth: 2, spentMinor: 600_000 },
      want: null,
    },
    {
      name: "under the plan mid-month is too early to say",
      input: { daysLeftInMonth: 20, spentMinor: 100_000 },
      want: null,
    },
    {
      name: "no plan means nothing to be under",
      input: { daysLeftInMonth: 2, plannedMinor: 0, spentMinor: 0 },
      want: null,
    },

    {
      name: "safe to spend holding positive mid-month",
      input: { dayOfMonth: 14, safeToSpendMinor: 250_000 },
      want: "safeToSpend",
    },
    {
      name: "positive but outside the mid-month window",
      input: { dayOfMonth: 25, safeToSpendMinor: 250_000 },
      want: null,
    },
    {
      name: "mid-month but already overspent",
      input: { dayOfMonth: 14, safeToSpendMinor: 0 },
      want: null,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(momentFor({ ...QUIET, ...c.input })).toBe(c.want);
    });
  }

  it("never returns more than one moment", () => {
    const everything: MomentInput = {
      entryCount: 1,
      daysLoggedLastWeek: 7,
      dayOfMonth: 14,
      daysLeftInMonth: 1,
      plannedMinor: 500_000,
      spentMinor: 100_000,
      safeToSpendMinor: 400_000,
    };
    expect(momentFor(everything)).toBe("firstEntry");
  });
});

describe("daysLoggedLastWeek", () => {
  const now = new Date(2026, 7, 17, 10, 0, 0); // Mon 17 Aug 2026
  // Sync delivers txn_date as midnight UTC, which is what the function reads.
  const at = (day: number) => Date.UTC(2026, 7, day);

  const cases: { name: string; stamps: number[]; want: number }[] = [
    { name: "no entries", stamps: [], want: 0 },
    { name: "several entries on one day count once", stamps: [at(17), at(17), at(17)], want: 1 },
    { name: "a full week", stamps: [11, 12, 13, 14, 15, 16, 17].map((d) => at(d)), want: 7 },
    { name: "the eighth day back falls outside the window", stamps: [at(10)], want: 0 },
    { name: "the seventh day back is inside it", stamps: [at(11)], want: 1 },
    { name: "gaps are not counted", stamps: [at(11), at(14), at(17)], want: 3 },
    { name: "a future-dated entry is not a day logged", stamps: [at(18), at(19)], want: 0 },
    {
      name: "future dates cannot pad a week",
      stamps: [at(17), ...[18, 19, 20, 21, 22, 23].map((d) => at(d))],
      want: 1,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(daysLoggedLastWeek(c.stamps, now)).toBe(c.want);
    });
  }
});

describe("loggedEntries", () => {
  const entries = [{ id: "opening" }, { id: "coffee" }];
  const lines = [
    { entryId: "opening", accountId: "bca" },
    { entryId: "opening", accountId: "equity" },
    { entryId: "coffee", accountId: "bca" },
    { entryId: "coffee", accountId: "food" },
  ];

  it("drops the entry that opened a pocket", () => {
    expect(loggedEntries(entries, lines, new Set(["equity"]))).toEqual([{ id: "coffee" }]);
  });

  it("keeps everything when the book has no equity account", () => {
    expect(loggedEntries(entries, lines, new Set())).toEqual(entries);
  });

  it("leaves an ordinary entry alone", () => {
    expect(loggedEntries([{ id: "coffee" }], lines, new Set(["equity"]))).toEqual([
      { id: "coffee" },
    ]);
  });
});
