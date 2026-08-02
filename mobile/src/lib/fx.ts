import { scale } from "./money";

// Client-side FX for display only. The ledger itself converts server-side at
// post time (see backend money.Convert); this exists so a screen can show a
// foreign balance in the base currency without a round trip per account.
//
// Staleness is surfaced, never hidden: every screen that converts also shows
// how old the table is, on the figure it affects (DESIGN.md → stale data).

/**
 * A rate row, structurally: `1 base = rate quote`. Declared here rather than
 * imported from the generated contract types so this module stays free of the
 * API client — the rows the client returns satisfy it as they are.
 */
export type Rate = { base: string; quote: string; rate: string };

export type RateTable = { rates: Rate[]; asOf: string | null };

export const EMPTY_RATES: RateTable = { rates: [], asOf: null };

/** Direct or inverted rate for from→to. Null when the table has no path. */
export function rateFor(from: string, to: string, table: RateTable): number | null {
  if (from === to) return 1;
  for (const r of table.rates) {
    if (r.base === from && r.quote === to) return Number(r.rate);
    if (r.base === to && r.quote === from) {
      const v = Number(r.rate);
      return v > 0 ? 1 / v : null;
    }
  }
  // Cross through any currency quoted against both.
  for (const a of table.rates) {
    if (a.base !== from) continue;
    for (const b of table.rates) {
      if (b.base === a.quote && b.quote === to) return Number(a.rate) * Number(b.rate);
    }
  }
  return null;
}

/**
 * Convert minor units between currencies, honouring each currency's scale
 * (IDR has none, KWD has three). Null propagates rather than defaulting to 1:1 —
 * a wrong number is worse than a missing one on a money screen.
 */
export function convert(
  minor: number,
  from: string,
  to: string,
  table: RateTable,
): number | null {
  const rate = rateFor(from, to, table);
  if (rate == null) return null;
  const major = minor / 10 ** scale(from);
  return Math.round(major * rate * 10 ** scale(to));
}

/** How stale the table is, in hours. Null when we have never pulled rates. */
export function ageHours(table: RateTable, now = Date.now()): number | null {
  if (!table.asOf) return null;
  const t = new Date(table.asOf).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now - t) / 3_600_000);
}

/** "1 USD = 16.284 IDR · cached 2h ago", or null when there is nothing to say. */
export function rateCaption(
  from: string,
  base: string,
  table: RateTable,
  now = Date.now(),
): string | null {
  const rate = rateFor(from, base, table);
  if (rate == null) return null;
  const age = ageHours(table, now);
  const shown = rate.toLocaleString("en-US", { maximumFractionDigits: 4 });
  const when =
    age == null ? "" : age < 1 ? " · cached just now" : ` · cached ${Math.round(age)}h ago`;
  return `1 ${from} = ${shown} ${base}${when}`;
}
