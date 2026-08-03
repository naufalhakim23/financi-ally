import { PieChart as PieIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { format } from "@financially/domain/money";
import { monthLabel } from "@financially/domain/ledger";

import { Amount, formatMoney } from "@/components/money";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategorySpend } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCashFlow, useMonthlySeries, useNetWorth, useSpending } from "@/lib/queries";
import { cn } from "@/lib/utils";

// Reports read server-computed endpoints, every figure here is normalized to
// the book's base currency by the backend, so this screen never does money
// arithmetic of its own. That is deliberate: two clients deriving reports
// independently is how they end up disagreeing.

// Categories past the ramp collapse into one "Other" slice. A donut with 15
// wedges is a color lookup puzzle, not a chart.
const MAX_SLICES = 7;
const RAMP = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--chart-${n})`);

type Range = { months: number; label: string };
const RANGES: Range[] = [
  { months: 1, label: "This month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
];

/** First day of the month `n` months back, and today, both `YYYY-MM-DD`. */
function rangeFor(months: number, now = new Date()): { from: string; to: string } {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)), to: iso(now) };
}

/** "Aug 26", the axis tick for a `YYYY-MM-DD` month start. */
function shortMonth(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Slice = { id: string; label: string; value: number; color: string };

function toSlices(spending: CategorySpend[]): Slice[] {
  // Sorted by the *base* figure, not the raw one: a list mixing currencies
  // would otherwise rank a large number in a weak currency above a small one
  // in a strong currency.
  const sorted = [...spending]
    .filter((s) => s.base_minor > 0)
    .sort((a, b) => b.base_minor - a.base_minor);

  const head: Slice[] = sorted.slice(0, MAX_SLICES).map((s, i) => ({
    id: s.account_id,
    label: s.account_name,
    value: s.base_minor,
    color: RAMP[i],
  }));

  const rest = sorted.slice(MAX_SLICES);
  if (rest.length > 0) {
    head.push({
      id: "__other",
      label: `Other (${rest.length})`,
      value: rest.reduce((sum, r) => sum + r.base_minor, 0),
      color: RAMP[MAX_SLICES],
    });
  }
  return head;
}

export function ReportsRoute() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";

  const [months, setMonths] = useState(1);
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => rangeFor(months, now), [months, now]);

  const worthQ = useNetWorth();
  const spendQ = useSpending(range.from, range.to);
  const flowQ = useCashFlow(range.from, range.to);
  // The trend is always 12 months regardless of the range picker: it exists to
  // show shape over time, and re-fetching it per range would flatten the very
  // thing it is there to show.
  const seriesQ = useMonthlySeries(12);

  const slices = useMemo(() => toSlices(spendQ.data ?? []), [spendQ.data]);
  const totalSpend = slices.reduce((s, x) => s + x.value, 0);

  const trend = useMemo(
    () =>
      (seriesQ.data?.points ?? []).map((p) => ({
        month: p.month.slice(0, 7),
        // Short on the axis, full in the tooltip: "September 2025" across
        // twelve ticks either overlaps or thins the axis down to three labels.
        label: shortMonth(p.month),
        full: monthLabel(p.month.slice(0, 7)),
        income: p.income_minor,
        expense: p.expense_minor,
        net: p.net_minor,
      })),
    [seriesQ.data],
  );

  const reportCurrency = worthQ.data?.base_currency ?? base;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title text-ink font-bold">Reports</h1>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Report period">
          {RANGES.map((r) => (
            <Button
              key={r.months}
              size="sm"
              variant={months === r.months ? "default" : "outline"}
              aria-pressed={months === r.months}
              onClick={() => setMonths(r.months)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          title="Net worth"
          pending={worthQ.isPending}
          failed={!!worthQ.error}
          onRetry={() => void worthQ.refetch()}
          currency={reportCurrency}
          minor={worthQ.data?.net_minor ?? null}
        />
        <Stat
          title="Money in"
          pending={flowQ.isPending}
          failed={!!flowQ.error}
          onRetry={() => void flowQ.refetch()}
          currency={reportCurrency}
          minor={flowQ.data?.income_minor.base_minor ?? null}
          tone="flow"
        />
        <Stat
          title="Money out"
          pending={flowQ.isPending}
          failed={!!flowQ.error}
          onRetry={() => void flowQ.refetch()}
          currency={reportCurrency}
          minor={flowQ.data?.expense_minor.base_minor ?? null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-headline text-ink font-semibold">Where it went</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {spendQ.error ? (
              <ErrorState
                message="Couldn't load spending."
                onRetry={() => void spendQ.refetch()}
              />
            ) : spendQ.isPending ? (
              <LoadingRows rows={4} />
            ) : slices.length === 0 ? (
              <EmptyState
                icon={<PieIcon className="size-7" strokeWidth={1.5} />}
                title="Nothing spent in this period"
                hint="Record a purchase and the breakdown appears here."
              />
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={slices}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="58%"
                        outerRadius="88%"
                        // Slot 1 at 12 o'clock, clockwise, same reading order
                        // as the mobile donut so the two look like one product.
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={1}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {slices.map((s) => (
                          <Cell key={s.id} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<MoneyTooltip currency={reportCurrency} total={totalSpend} />}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* The legend doubles as the value table: identity must never
                    rest on color alone (DESIGN.md → Charts, and CVD readers). */}
                <ul className="divide-outline-variant divide-y">
                  {slices.map((s) => (
                    <li key={s.id} className="flex items-center gap-2.5 py-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-body text-ink min-w-0 flex-1 truncate">{s.label}</span>
                      <span className="text-amount-sm text-faint font-mono">
                        {totalSpend > 0 ? Math.round((s.value / totalSpend) * 100) : 0}%
                      </span>
                      <Amount currency={reportCurrency} minor={s.value} size="sm" />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-headline text-ink font-semibold">
              In and out, by month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {seriesQ.error ? (
              <ErrorState message="Couldn't load the trend." onRetry={() => void seriesQ.refetch()} />
            ) : seriesQ.isPending ? (
              <LoadingRows rows={4} />
            ) : trend.length === 0 ? (
              <EmptyState title="No history yet" hint="Months fill in as you record entries." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tick={{ fill: "var(--faint)", fontSize: 11 }}
                    />
                    <YAxis
                      width={64}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--faint)", fontSize: 11 }}
                      // Minor units on an axis would read as an absurd number of
                      // digits; the tooltip carries the exact figure.
                      tickFormatter={(v: number) => compact(reportCurrency, v)}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--surface-container)" }}
                      content={<MoneyTooltip currency={reportCurrency} />}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: "var(--dim)" }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar dataKey="income" name="In" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expense" name="Out" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  title,
  pending,
  failed,
  onRetry,
  currency,
  minor,
  tone,
}: {
  title: string;
  pending: boolean;
  failed?: boolean;
  onRetry?: () => void;
  currency: string;
  minor: number | null;
  tone?: "plain" | "flow";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-label text-faint font-semibold uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {failed ? (
          // A dash here reads as "zero", the one lie a finance screen must not tell.
          <ErrorState message="Couldn't load this figure." onRetry={onRetry} />
        ) : pending ? (
          <LoadingRows rows={1} />
        ) : (
          <Amount currency={currency} minor={minor} size="lg" tone={tone} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Axis labels in thousands/millions.
 *
 * Rounds only what is *displayed* on the axis, every exact figure on this
 * screen comes from `format`, never from this.
 */
function compact(currency: string, minor: number): string {
  const major = Number(format(currency, Math.abs(minor)).replace(/,/g, ""));
  const sign = minor < 0 ? "−" : "";
  if (major >= 1_000_000_000) return `${sign}${(major / 1_000_000_000).toFixed(1)}B`;
  if (major >= 1_000_000) return `${sign}${(major / 1_000_000).toFixed(1)}M`;
  if (major >= 1_000) return `${sign}${Math.round(major / 1_000)}k`;
  return `${sign}${Math.round(major)}`;
}

type TooltipEntry = { name?: string; value?: number; color?: string; payload?: { full?: string } };

function MoneyTooltip({
  active,
  payload,
  label,
  currency,
  total,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  currency: string;
  /** When given, each row also shows its share, used by the donut. */
  total?: number;
}) {
  if (!active || !payload?.length) return null;
  // The axis is abbreviated to fit; the tooltip has room for the real month.
  const heading = payload[0]?.payload?.full ?? label;
  return (
    <div className="border-outline bg-surface shadow-raised rounded-lg border px-3 py-2">
      {heading ? <p className="text-caption text-faint mb-1">{heading}</p> : null}
      {payload.map((row, i) => (
        <p key={i} className={cn("text-amount-sm text-ink font-mono", i > 0 && "mt-0.5")}>
          {row.name ? <span className="text-dim mr-2">{row.name}</span> : null}
          {formatMoney(currency, row.value ?? 0)}
          {total && total > 0 ? (
            <span className="text-faint ml-2">
              {Math.round(((row.value ?? 0) / total) * 100)}%
            </span>
          ) : null}
        </p>
      ))}
    </div>
  );
}
