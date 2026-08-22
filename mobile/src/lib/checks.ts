// Self-check for the mobile-only pure logic. The money math (fx, ledger,
// buckets, csv) moved to shared-context/domain and is covered by Vitest there —
// `yarn --cwd ../shared-context/domain test` — so both clients get one suite.
//
// What is left here is the keypad and the date picker's calendar math, both
// mobile input concerns with no web counterpart. Run it with `npm run check`.
//
// The script pins TZ to a DST-observing zone. The calendar assertions are all
// local-time relative, so they hold anywhere — but the DST one is vacuous in a
// zone without DST, and most of the team sits in one (WIB).

function ok(condition: boolean, what: string): void {
  if (!condition) throw new Error(`check failed: ${what}`);
}

const assert = {
  ok,
  equal: (a: unknown, b: unknown, what: string) =>
    ok(a === b, `${what} (got ${String(a)}, wanted ${String(b)})`),
};

import { applyKey } from "./keypad";

assert.equal(applyKey("", "4"), "4", "first digit");
assert.equal(applyKey("0", "5"), "5", "a leading zero is replaced");
assert.equal(applyKey("45", "000"), "45000", "the triple appends three zeros");
assert.equal(applyKey("45", "back"), "4", "backspace");
assert.equal(applyKey("", "back"), "", "backspace on empty is a no-op");
assert.equal(applyKey("999999999999999", "9").length, 15, "capped before toMinor can overflow");

import { addDays, dayLabel, monthCells, shiftMonth, startOfDay, startOfMonth } from "./day";

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();

assert.equal(startOfDay(at(2026, 8, 22, 23)), at(2026, 8, 22), "startOfDay drops the clock");
assert.equal(startOfMonth(at(2026, 8, 22)), at(2026, 8, 1), "startOfMonth walks back to the 1st");

// The reason addDays exists, and why this file is pinned to a DST zone: on the
// day after a spring-forward, `ms - 86_400_000` lands 23 hours back, which is
// still the same calendar day once normalised — so the naive version skips a
// day. In Europe/London, 30 March 2026 - 1 day is the 29th, not the 28th.
assert.equal(
  startOfDay(addDays(at(2026, 3, 30), -1)),
  at(2026, 3, 29),
  "the day after a DST transition steps back onto the transition day",
);
assert.equal(startOfDay(addDays(at(2026, 1, 1), -1)), at(2025, 12, 31), "and across a year boundary");

assert.equal(shiftMonth(at(2026, 12, 1), 1), at(2027, 1, 1), "shiftMonth wraps the year forward");
assert.equal(shiftMonth(at(2026, 1, 1), -1), at(2025, 12, 1), "and backward");
// A month with 31 days that starts on a Saturday: 5 blanks then 31 days.
assert.equal(monthCells(at(2026, 8, 1)).length, 5 + 31, "August 2026 lays out as 5 blanks + 31 days");
assert.equal(monthCells(at(2026, 8, 1))[4], null, "the last blank is still a blank");
assert.equal(monthCells(at(2026, 8, 1))[5], at(2026, 8, 1), "the first real cell is the 1st");
// A Monday start needs no leading blanks at all.
assert.equal(monthCells(at(2026, 6, 1)).length, 30, "June 2026 starts on a Monday, so no blanks");
assert.equal(monthCells(at(2024, 2, 1)).length, 3 + 29, "February 2024 is a leap month");

const now = at(2026, 8, 22, 15);
assert.equal(dayLabel(at(2026, 8, 22, 9), now), "Today", "today is named, not dated");
assert.equal(dayLabel(at(2026, 8, 21), now), "Yesterday", "so is yesterday");
assert.ok(!/2026/.test(dayLabel(at(2026, 8, 3), now)), "the current year is left off");
assert.ok(/2025/.test(dayLabel(at(2025, 8, 3), now)), "another year is spelled out");

console.log("all checks passed");
