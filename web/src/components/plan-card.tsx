import { CreditCard, Globe, ShoppingBag, Target, Wallet } from "lucide-react";
import { Link } from "react-router";

import type { Bucket, SpendingRow } from "@financially/domain/buckets";
import { rateCaption, type RateTable } from "@financially/domain/fx";

import { Amount, formatMoney } from "@/components/money";
import { ProgressBar, textToneFor } from "@/components/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSplitAccordion, type SplitAccordionItem } from "@/components/ui/card-split-accordion";
import { Button } from "@/components/ui/button";
import { useWording } from "@/lib/wording";

// The plan half of the dashboard: what is left to spend, and where the money is
// bucketed.
//
// The earlier version showed safe-to-spend as a bare hero figure. With no
// budget set that number is a truthful zero and a useless one — it looks like
// the user is broke rather than un-budgeted. So the card now has two states,
// and the budgeted one shows the ratio it was derived from instead of only its
// result: a figure a user cannot see the arithmetic behind is a figure they
// stop trusting the first time it surprises them.

/** Tile classes are written out so Tailwind can see them; slot comes from data. */
const TILE = [
  "bg-chart-1-wash text-chart-1",
  "bg-chart-2-wash text-chart-2",
  "bg-chart-3-wash text-chart-3",
  "bg-chart-4-wash text-chart-4",
  "bg-chart-5-wash text-chart-5",
  "bg-chart-6-wash text-chart-6",
  "bg-chart-7-wash text-chart-7",
  "bg-chart-8-wash text-chart-8",
];

const BUCKET_ICON = {
  cash: Wallet,
  foreign: Globe,
  spending: ShoppingBag,
  owed: CreditCard,
} as const;

export function SafeToSpendCard({
  spending,
  safe,
  daysLeft,
  base,
  className,
}: {
  spending: SpendingRow[];
  safe: number;
  daysLeft: number;
  base: string;
  className?: string;
}) {
  const { t } = useWording();

  const planned = spending.reduce((sum, row) => sum + (row.target ?? 0), 0);
  const spent = spending.reduce((sum, row) => sum + row.spent, 0);
  const pct = planned > 0 ? (spent / planned) * 100 : 0;
  // Integer division of minor units, so the daily figure never invents a
  // fraction of a cent the user could not actually spend.
  const perDay = daysLeft > 0 ? Math.floor(safe / daysLeft) : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-label text-faint font-semibold uppercase">
          {t("safeToSpend")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {planned === 0 ? (
          <div className="space-y-3">
            <p className="text-body text-dim">
              No budget set for this month, so there is no plan to spend against yet. You have spent{" "}
              {formatMoney(base, spent)} so far.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/app/budgets">
                <Target className="size-4" />
                Set a budget
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <Amount currency={base} minor={safe} size="hero" />
            <ProgressBar pct={pct} />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-caption text-faint">
                {formatMoney(base, spent)} spent of {formatMoney(base, planned)}
              </span>
              <span className={`text-caption font-semibold ${textToneFor(pct)}`}>
                {Math.round(pct)}% of plan used
              </span>
            </div>
            <p className="text-caption text-faint">
              {formatMoney(base, perDay)} a day for the {daysLeft}{" "}
              {daysLeft === 1 ? "day" : "days"} left this month
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function BucketList({
  buckets,
  spending,
  base,
  rates,
}: {
  buckets: Bucket[];
  spending: SpendingRow[];
  base: string;
  rates: RateTable;
}) {
  const items: SplitAccordionItem[] = buckets.map((bucket) => {
    const Icon = BUCKET_ICON[bucket.id];
    return {
      id: bucket.id,
      icon: (
        <span className={`grid size-9 place-items-center rounded-lg ${TILE[bucket.slot % 8]}`}>
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
      ),
      // The count used to appear only when the bucket was empty, which is the
      // one case where it says least. It is now always visible, so a collapsed
      // stack answers "how many" without four clicks.
      title: (
        <span className="flex flex-col">
          <span className="text-body-lg text-ink font-semibold">{bucket.title}</span>
          <span className="text-caption text-faint font-normal">{bucket.subtitle}</span>
        </span>
      ),
      meta: <Amount currency={base} minor={bucket.total} size="base" />,
      content:
        bucket.id === "spending" ? (
          <SpendingRows rows={spending} base={base} />
        ) : bucket.children.length === 0 ? (
          <p className="text-body text-dim">Nothing here yet.</p>
        ) : (
          <ul className="divide-outline-variant divide-y">
            {bucket.children.map((child) => (
              <li key={child.account.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="text-body text-ink block truncate">{child.account.name}</span>
                  {child.account.currency !== base ? (
                    <span className="text-caption text-faint">
                      {rateCaption(child.account.currency, base, rates) ?? "no rate available"}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <Amount currency={child.account.currency} minor={child.balance} size="sm" />
                  {child.account.currency !== base ? (
                    <Amount currency={base} minor={child.base} size="sm" tone="dim" />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ),
    };
  });

  return <CardSplitAccordion items={items} />;
}

function SpendingRows({ rows, base }: { rows: SpendingRow[]; base: string }) {
  if (rows.length === 0) {
    return <p className="text-body text-dim">Nothing spent yet this month.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const pct = row.target && row.target > 0 ? (row.spent / row.target) * 100 : null;
        return (
          <li key={row.account.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body text-ink truncate">{row.account.name}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <Amount currency={base} minor={row.spent} size="sm" />
                {row.target != null ? (
                  <span className="text-caption text-faint">
                    of {formatMoney(row.currency, row.target)}
                  </span>
                ) : null}
              </span>
            </div>
            {/* Only budgeted categories get a bar — a track with no target is a
                progress bar toward nothing. */}
            {pct != null ? <ProgressBar pct={pct} className="h-1.5" /> : null}
          </li>
        );
      })}
    </ul>
  );
}
