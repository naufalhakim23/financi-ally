// Which acknowledgment a screen may show, if any. Copy lives in the catalog.

const MONTH_END_DAYS = 3;
const FULL_WEEK_DAYS = 7;
const MID_MONTH_FROM = 12;
const MID_MONTH_TO = 18;

export type MomentKey = "firstEntry" | "weekOfLogging" | "underBudget" | "safeToSpend";

export type MomentInput = {
  entryCount: number;
  daysLoggedLastWeek: number;
  dayOfMonth: number;
  daysLeftInMonth: number;
  /** Zero means no plan to be under. */
  plannedMinor: number;
  spentMinor: number;
  safeToSpendMinor: number;
};

// Returns one key at most, so a screen cannot stack two. Rarest first.
export function momentFor(input: MomentInput): MomentKey | null {
  if (input.entryCount === 1) return "firstEntry";
  if (input.daysLoggedLastWeek >= FULL_WEEK_DAYS) return "weekOfLogging";
  if (
    input.daysLeftInMonth <= MONTH_END_DAYS &&
    input.plannedMinor > 0 &&
    input.spentMinor < input.plannedMinor
  ) {
    return "underBudget";
  }
  if (
    input.dayOfMonth >= MID_MONTH_FROM &&
    input.dayOfMonth <= MID_MONTH_TO &&
    input.safeToSpendMinor > 0
  ) {
    return "safeToSpend";
  }
  return null;
}

// `txn_date` is a SQL DATE, which sync sends as midnight UTC. Reading it with
// the local getters lands on the previous day in any zone west of UTC, so the
// calendar day comes off the UTC side and is rebuilt against the local clock
// that `now` and `cutoff` are measured in.
function calendarDay(msAtUTCMidnight: number): Date {
  const d = new Date(msAtUTCMidnight);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Bounded above too: future-dated entries arrive by sync or clock skew, and six
// of them plus today would otherwise read as a full week.
export function daysLoggedLastWeek(timestamps: number[], now: Date): number {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (FULL_WEEK_DAYS - 1));
  const days = new Set<string>();
  for (const ts of timestamps) {
    const d = calendarDay(ts);
    if (d < cutoff || d > now) continue;
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size;
}

// Drops opening balances: they are posted entries nobody logged, and the only
// ones touching an equity account.
export function loggedEntries<E extends { id: string }>(
  entries: E[],
  lines: { entryId: string; accountId: string }[],
  equityAccountIds: Set<string>,
): E[] {
  if (equityAccountIds.size === 0) return entries;
  const opening = new Set<string>();
  for (const l of lines) if (equityAccountIds.has(l.accountId)) opening.add(l.entryId);
  return entries.filter((e) => !opening.has(e.id));
}
