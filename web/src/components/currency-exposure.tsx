import type { Account } from "@financially/domain/types";
import { convert, type RateTable } from "@financially/domain/fx";

import { formatMoney } from "@/components/money";

// How much of the book sits in each currency, as one bar.
//
// Deliberately not a recharts chart: a single-series composition reads better
// as a bar than as a pie, and a pie of three slices costs a chart runtime for
// geometry that is four divs.

export type ExposureRow = { code: string; minor: number };

export type Exposure = {
  rows: ExposureRow[];
  /** Currencies dropped because no rate path to base exists. */
  unconverted: string[];
};

/**
 * Asset balances grouped by their own currency, each normalized to base.
 *
 * Assets only: a liability is money owed, not money held, and folding it in
 * would net a rupiah card against a dollar account and call the result
 * exposure. Only positive holdings are shown, for the same reason.
 */
export function currencyExposure(
  accounts: Account[],
  balanceOf: (account: Account) => number,
  base: string,
  rates: RateTable,
): Exposure {
  const totals = new Map<string, number>();
  const unconverted = new Set<string>();

  for (const account of accounts) {
    if (account.archived || account.type !== "asset") continue;
    const balance = balanceOf(account);
    if (balance <= 0) continue;

    const inBase =
      account.currency === base ? balance : convert(balance, account.currency, base, rates);
    if (inBase == null) {
      unconverted.add(account.currency);
      continue;
    }
    totals.set(account.currency, (totals.get(account.currency) ?? 0) + inBase);
  }

  return {
    rows: [...totals]
      .map(([code, minor]) => ({ code, minor }))
      .sort((a, b) => b.minor - a.minor),
    unconverted: [...unconverted],
  };
}

/** Slot by rank, largest first, so the biggest holding keeps the same color. */
const slotOf = (index: number) => `var(--chart-${(index % 8) + 1})`;

export function CurrencyExposure({ exposure, base }: { exposure: Exposure; base: string }) {
  const total = exposure.rows.reduce((sum, r) => sum + r.minor, 0);

  if (total === 0) {
    return <p className="text-body text-dim">No positive balances to split yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="bg-surface-container flex h-2.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={exposure.rows
          .map((r) => `${r.code} ${Math.round((r.minor / total) * 100)}%`)
          .join(", ")}
      >
        {exposure.rows.map((row, i) => (
          <span
            key={row.code}
            style={{ width: `${(row.minor / total) * 100}%`, background: slotOf(i) }}
          />
        ))}
      </div>

      {/* The bar carries no meaning without this: color alone never identifies
          a currency, and three of the ramp slots are close in luminance. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {exposure.rows.map((row, i) => (
          <li key={row.code} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: slotOf(i) }}
            />
            <span className="text-caption text-ink font-semibold">{row.code}</span>
            <span className="text-amount-sm text-faint tabular font-mono">
              {formatMoney(base, row.minor)}
            </span>
          </li>
        ))}
      </ul>

      {exposure.unconverted.length > 0 ? (
        <p className="text-caption text-warning-strong">
          {exposure.unconverted.join(", ")} left out — no rate to {base}
        </p>
      ) : null}
    </div>
  );
}
