import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

import { buildBuckets, daysLeftInMonth, safeToSpend, spendingForMonth } from "@financially/domain/buckets";
import { buildEntryViews, monthKey } from "@financially/domain/ledger";
import { rateCaption } from "@financially/domain/fx";

import { AddEntryButton } from "@/components/add-entry-button";
import { EntryRow } from "@/components/entry-row";
import { Amount, formatMoney } from "@/components/money";
import { SetupChecklist } from "@/components/setup-checklist";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSplitAccordion, type SplitAccordionItem } from "@/components/ui/card-split-accordion";
import { useAuth } from "@/lib/auth";
import {
  BOOK_WINDOW_MONTHS,
  periodOf,
  rollingRange,
  useAccountBalances,
  useAccounts,
  useBudgets,
  useEntries,
  useFxRates,
  useNetWorth,
} from "@/lib/queries";
import { useWording } from "@/lib/wording";

const RECENT_COUNT = 6;

export function DashboardRoute() {
  const { user } = useAuth();
  const { t } = useWording();
  const base = user?.base_currency ?? "IDR";

  const now = useMemo(() => new Date(), []);
  // A rolling window, not the whole book: /entries is unpaginated and there is
  // no local store to soften a full download. Shared with the pockets screen so
  // the two cannot derive different figures from different spans of history.
  const window = useMemo(() => rollingRange(BOOK_WINDOW_MONTHS, now), [now]);

  const accountsQ = useAccounts();
  const entriesQ = useEntries(window.from, window.to);
  const budgetsQ = useBudgets(periodOf(now));
  const fxQ = useFxRates();
  // Bucket balances are whole-book figures like net worth. The windowed lines
  // only feed this month's spending and the recent list.
  const balancesQ = useAccountBalances();
  // Net worth comes from the server, not from the windowed lines above: it is a
  // whole-book figure, and an entry older than the window would silently drop
  // out of the one number on this screen nobody would think to double-check.
  const worthQ = useNetWorth();

  const loading = accountsQ.isPending || entriesQ.isPending || balancesQ.isPending;
  const error =
    accountsQ.error ?? entriesQ.error ?? budgetsQ.error ?? worthQ.error ?? balancesQ.error;

  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);

  // Which entries fall in the current month — spendingForMonth measures a
  // period, not a balance, so it needs the ids rather than a date filter.
  const monthEntryIds = useMemo(() => {
    const key = monthKey(now);
    return new Set(
      entriesQ.entries.filter((e) => monthKey(new Date(e.txnDate)) === key).map((e) => e.id),
    );
  }, [entriesQ.entries, now]);

  const spending = useMemo(
    () =>
      spendingForMonth(
        accountsQ.accounts,
        entriesQ.lines,
        monthEntryIds,
        budgetsQ.budgets,
        base,
        monthStart,
      ),
    [accountsQ.accounts, entriesQ.lines, monthEntryIds, budgetsQ.budgets, base, monthStart],
  );

  const buckets = useMemo(
    () => buildBuckets(accountsQ.accounts, balancesQ.balanceOf, base, fxQ.rates, spending),
    [accountsQ.accounts, balancesQ.balanceOf, base, fxQ.rates, spending],
  );

  const recent = useMemo(
    () => buildEntryViews(entriesQ.entries, entriesQ.lines, accountsQ.accounts).slice(0, RECENT_COUNT),
    [entriesQ.entries, entriesQ.lines, accountsQ.accounts],
  );

  const safe = safeToSpend(spending);
  const daysLeft = daysLeftInMonth(now);

  const bucketItems: SplitAccordionItem[] = buckets.map((b) => ({
    id: b.id,
    title: b.title,
    meta: <Amount currency={base} minor={b.total} size="base" />,
    content:
      b.id === "spending" ? (
        spending.length === 0 ? (
          <p className="text-body text-dim">Nothing spent yet this month.</p>
        ) : (
          <ul className="divide-outline-variant divide-y">
            {spending.map((row) => (
              <li key={row.account.id} className="flex items-center justify-between py-2">
                <span className="text-body text-ink truncate">{row.account.name}</span>
                <span className="flex items-center gap-2">
                  <Amount currency={base} minor={row.spent} size="sm" />
                  {row.target != null ? (
                    <span className="text-caption text-faint">
                      of {formatMoney(row.currency, row.target)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : b.children.length === 0 ? (
        <p className="text-body text-dim">{b.subtitle}</p>
      ) : (
        <ul className="divide-outline-variant divide-y">
          {b.children.map((child) => (
            <li key={child.account.id} className="flex items-center justify-between py-2">
              <span className="min-w-0">
                <span className="text-body text-ink block truncate">{child.account.name}</span>
                {child.account.currency !== base ? (
                  <span className="text-caption text-faint">
                    {rateCaption(child.account.currency, base, fxQ.rates) ?? "no rate available"}
                  </span>
                ) : null}
              </span>
              <span className="flex flex-col items-end">
                <Amount currency={child.account.currency} minor={child.balance} size="sm" />
                {child.account.currency !== base ? (
                  <Amount currency={base} minor={child.base} size="sm" tone="dim" />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title text-ink font-bold">Dashboard</h1>
        <AddEntryButton />
      </div>

      {error ? (
        <ErrorState
          message="Couldn't load your book. Check your connection and try again."
          onRetry={() => {
            void accountsQ.refetch();
            void entriesQ.refetch();
            void budgetsQ.refetch();
            void worthQ.refetch();
            void balancesQ.refetch();
          }}
        />
      ) : null}

      <SetupChecklist />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-label text-faint font-semibold uppercase">
              {t("totalMoney")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {worthQ.isPending ? (
              <LoadingRows rows={1} />
            ) : (
              <Amount
                currency={worthQ.data?.base_currency ?? base}
                minor={worthQ.data?.net_minor ?? null}
                size="hero"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-label text-faint font-semibold uppercase">
              {t("safeToSpend")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              <LoadingRows rows={1} />
            ) : (
              <>
                <Amount currency={base} minor={safe} size="hero" />
                <p className="text-caption text-faint">
                  {daysLeft} {daysLeft === 1 ? "day" : "days"} left this month
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-headline text-ink font-semibold">{t("buckets")}</h2>
          {loading ? <LoadingRows /> : <CardSplitAccordion items={bucketItems} />}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-headline text-ink font-semibold">Recent</h2>
            <Link to="/app/history" className="text-label text-info-strong hover:underline">
              See all
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4">
                  <LoadingRows />
                </div>
              ) : recent.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp className="size-7" strokeWidth={1.5} />}
                  title="No entries yet"
                  hint="Record a purchase or some income and your buckets fill in."
                  action={
                    <AddEntryButton />
                  }
                />
              ) : (
                <ul className="divide-outline-variant divide-y">
                  {recent.map((view) => (
                    <EntryRow key={view.entry.id} view={view} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
