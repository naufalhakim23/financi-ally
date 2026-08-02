import { format, scale } from "@financially/domain/money";

import { cn } from "@/lib/utils";

// Money on screen.
//
// Grouping is done here rather than in the domain because it is a *display*
// concern that depends on the viewer's locale, while the domain owns the exact
// minor-unit arithmetic that must be identical on every client. The domain
// hands over a decimal string; this splits and groups it without ever putting
// the number through a float.

function group(decimal: string, locale?: string): string {
  const negative = decimal.startsWith("-");
  const bare = negative ? decimal.slice(1) : decimal;
  const [whole, fraction] = bare.split(".");
  const grouped = Number(whole).toLocaleString(locale, { useGrouping: true });
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}

/** "Rp 1.240.000" / "$1,240.00" — the currency code, then the grouped figure. */
export function formatMoney(currency: string, minor: number, locale?: string): string {
  return `${currency} ${group(format(currency, minor), locale)}`;
}

/** Just the figure, no currency code — for columns that label the currency once. */
export function formatAmount(currency: string, minor: number, locale?: string): string {
  return group(format(currency, minor), locale);
}

export type AmountSize = "hero" | "lg" | "base" | "sm";

const SIZE: Record<AmountSize, string> = {
  hero: "text-amount-hero font-bold",
  lg: "text-amount-lg font-bold",
  base: "text-amount font-medium",
  sm: "text-amount-sm font-medium",
};

/**
 * A signed figure.
 *
 * `tone="flow"` colors by sign — green for money in, plain ink for money out.
 * Red is reserved for errors and destructive actions, never for ordinary
 * spending: a grocery run is not a failure, and coloring it red trains the user
 * to ignore the one color that should stop them.
 */
export function Amount({
  currency,
  minor,
  size = "base",
  tone = "plain",
  showSign = false,
  className,
}: {
  currency: string;
  minor: number | null;
  size?: AmountSize;
  tone?: "plain" | "flow" | "dim";
  showSign?: boolean;
  className?: string;
}) {
  // Null means "we could not convert this", never zero. Showing 0 where a
  // number is unknown is the one rounding error a user cannot detect.
  if (minor === null) {
    return <span className={cn("text-faint text-amount-sm font-mono", className)}>—</span>;
  }

  const positive = minor > 0;
  const sign = showSign && minor !== 0 ? (positive ? "+" : "−") : minor < 0 ? "−" : "";
  const body = formatAmount(currency, Math.abs(minor));

  return (
    <span
      className={cn(
        "tabular font-mono whitespace-nowrap",
        SIZE[size],
        tone === "flow" && positive && "text-success-strong",
        tone === "flow" && !positive && "text-ink",
        tone === "dim" && "text-dim",
        className,
      )}
    >
      {sign}
      {body}
      <span className="text-faint text-mono-meta ml-1">{currency}</span>
    </span>
  );
}

/** Currencies with no minor unit take no decimals in an input, either. */
export function decimalsFor(currency: string): number {
  return scale(currency);
}
