// Calendar math for the date picker. Pure and RN-free so `checks.ts` can run
// it, the same split keypad.ts has from the Keypad component.
//
// Every function works in local time. The ledger stores a date, not an instant
// (txn_date round-trips through a server DATE column), so a picked day is
// pinned to local midnight and time-of-day is never carried.

/**
 * Day arithmetic goes through Date, never through 86_400_000: a day is 23 or 25
 * hours across a DST boundary, and "yesterday" has to stay yesterday in March.
 */
export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Local midnight, so two picked days compare as equal whatever time it was. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** First moment of the month `ms` falls in. */
export function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** `startOfMonth` shifted by whole months, wrapping the year as needed. */
export function shiftMonth(monthStart: number, by: number): number {
  const d = new Date(monthStart);
  return new Date(d.getFullYear(), d.getMonth() + by, 1).getTime();
}

/**
 * The grid a month renders as: leading nulls for the blank cells before the
 * first, then one local-midnight timestamp per day. Monday-first, because
 * getDay() is Sunday-first and the week here starts on Monday.
 */
export function monthCells(monthStart: number): (number | null)[] {
  const d = new Date(monthStart);
  const year = d.getFullYear();
  const month = d.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  // Day 0 of the next month is the last day of this one.
  const days = new Date(year, month + 1, 0).getDate();
  return [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1).getTime()),
  ];
}

/** What the date chip on the add sheet says. `now` is injectable for tests. */
export function dayLabel(ms: number, now: number = Date.now()): string {
  const today = startOfDay(now);
  const day = startOfDay(ms);
  if (day === today) return "Today";
  if (day === startOfDay(addDays(today, -1))) return "Yesterday";
  const d = new Date(day);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    // The year only earns its space once the date leaves the current one.
    ...(d.getFullYear() === new Date(today).getFullYear() ? {} : { year: "numeric" }),
  });
}
