// Acknowledgment moments: the app noticing something, once.
//
// The rule from DESIGN.md is acknowledge, never celebrate. A moment is a single
// quiet line in a card that already exists, so this module answers only "is
// there anything worth saying right now, and which one" — never how to say it
// (that is the string catalog) or where (that is the screen).
//
// One moment per screen is enforced here rather than left to callers: the
// function returns at most one key, in priority order, so a screen physically
// cannot stack two.

/** The last few days of a month, when "you stayed under" is finally true. */
const MONTH_END_DAYS = 3;

/** A full week means every one of the last seven days, not five of them. */
const FULL_WEEK_DAYS = 7;

/** Mid-month: early enough that holding positive still predicts the month. */
const MID_MONTH_FROM = 12;
const MID_MONTH_TO = 18;

export type MomentKey = "firstEntry" | "weekOfLogging" | "underBudget" | "safeToSpend";

export type MomentInput = {
  /** Entries in this book, all time. */
  entryCount: number;
  /** Distinct days carrying an entry across the last seven, today included. */
  daysLoggedLastWeek: number;
  dayOfMonth: number;
  daysLeftInMonth: number;
  /** Sum of this month's budget targets. Zero means no plan to be under. */
  plannedMinor: number;
  spentMinor: number;
  safeToSpendMinor: number;
};

/**
 * The one thing worth acknowledging, or nothing.
 *
 * Order is priority, rarest first: a first entry happens once per book and
 * outranks a pattern that recurs every month.
 */
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

/**
 * Distinct days carrying an entry across the last seven, today included.
 *
 * Takes timestamps rather than entries so the domain stays storage-free — the
 * caller owns whatever record shape it reads them off.
 *
 * Bounded at both ends. An entry dated in the future is not a day the user has
 * logged, and one can arrive from another device or a skewed clock; without the
 * upper bound six of them plus today would read as a full week.
 */
export function daysLoggedLastWeek(timestamps: number[], now: Date): number {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (FULL_WEEK_DAYS - 1));
  const days = new Set<string>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (d < cutoff || d > now) continue;
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size;
}

/**
 * The entries a person actually logged.
 *
 * An opening balance is a real posted entry, but nobody logged it — it is the
 * ledger's way of saying a pocket already had money in it, and it is the only
 * kind of entry that touches an equity account. Counting it would greet someone
 * who has just created their first pocket with "that's your first one logged"
 * over an empty ledger.
 */
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
