// Recurring rules, as three plain choices compiled to an iCalendar RRULE.
//
// The double-entry shape and the RRULE syntax both stay behind the UI: a user
// picks "monthly, on the 1st", not "FREQ=MONTHLY;BYMONTHDAY=1". Extracted from
// mobile's recurring screen when the web client needed the same three
// functions, a rule authored on one client has to read back identically on the
// other, and two parsers is how that stops being true.

export type Freq = "daily" | "weekly" | "monthly";

export type Recurrence = { freq: Freq; monthDay: number; weekDay: string };

export const WEEKDAYS: { value: string; label: string }[] = [
  { value: "MO", label: "Mon" },
  { value: "TU", label: "Tue" },
  { value: "WE", label: "Wed" },
  { value: "TH", label: "Thu" },
  { value: "FR", label: "Fri" },
  { value: "SA", label: "Sat" },
  { value: "SU", label: "Sun" },
];

/**
 * Highest day-of-month a rule may target.
 *
 * Capped at 28 so every month has the day, a rule on the 31st would skip
 * February entirely, which reads as the app losing an entry.
 */
export const MAX_MONTH_DAY = 28;

export function buildRRule({ freq, monthDay, weekDay }: Recurrence): string {
  switch (freq) {
    case "daily":
      return "FREQ=DAILY";
    case "weekly":
      return `FREQ=WEEKLY;BYDAY=${weekDay}`;
    case "monthly":
      return `FREQ=MONTHLY;BYMONTHDAY=${monthDay}`;
  }
}

/** Reads an RRULE back into the form's fields, so editing shows what was saved. */
export function parseRRule(rrule: string): Recurrence {
  const parts = Object.fromEntries(
    rrule
      .replace(/^RRULE:/, "")
      .split(";")
      .map((p) => p.split("=") as [string, string]),
  );
  const freq: Freq =
    parts.FREQ === "DAILY" ? "daily" : parts.FREQ === "WEEKLY" ? "weekly" : "monthly";
  return {
    freq,
    monthDay: Number(parts.BYMONTHDAY ?? 1) || 1,
    weekDay: parts.BYDAY ?? "MO",
  };
}

/** "Every Mon" / "Monthly on the 1st", the rule in the user's words. */
export function describeRRule(rrule: string): string {
  const { freq, monthDay, weekDay } = parseRRule(rrule);
  if (freq === "daily") return "Every day";
  if (freq === "weekly") {
    return `Every ${WEEKDAYS.find((d) => d.value === weekDay)?.label ?? weekDay}`;
  }
  return `Monthly on the ${monthDay}${ordinal(monthDay)}`;
}

export function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}
