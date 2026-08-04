import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { buildBuckets, daysLeftInMonth, safeToSpend, spendingForMonth } from "@financially/domain/buckets";
import { buildEntryViews, monthKey } from "@financially/domain/ledger";

import { AccountPanel, type AccountSelection } from "@/components/account-panel";
import { AddEntryButton } from "@/components/add-entry-button";
import { CurrencyExposure, currencyExposure } from "@/components/currency-exposure";
import { EntryTable } from "@/components/entry-table";
import { Amount } from "@/components/money";
import { BucketList, SafeToSpendCard } from "@/components/plan-card";
import { SetupChecklist } from "@/components/setup-checklist";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAuth } from "@/lib/auth";
import {
  BOOK_WINDOW_MONTHS,
  periodOf,
  periodRange,
  rollingRange,
  useAccountBalances,
  useAccounts,
  useBudgets,
  useCashFlow,
  useEntries,
  useFxRates,
  useNetWorth,
  type Period,
} from "@/lib/queries";
import { useWording } from "@/lib/wording";

// Two columns: where the money sits on the left, what it did on the right, with
// the month's plan underneath. The account list on the left is also the filter
// for the ledger on the right — selecting is how you narrow, so there is no
// separate filter control to find.

const RECENT_COUNT = 8;

const PERIODS = [
  { value: "week" as const, label: "Week" },
  { value: "month" as const, label: "Month" },
  { value: "year" as const, label: "Year" },
];

export function DashboardRoute() {
  const { user } = useAuth();
  const { t } = useWording();
  const base = user?.base_currency ?? "IDR";

  const now = useMemo(() => new Date(), []);
  // A rolling window, not the whole book: /entries is unpaginated and there is
  // no local store to soften a full download. Shared with the pockets screen so
  // the two cannot derive different figures from different spans of history.
  const window = useMemo(() => rollingRange(BOOK_WINDOW_MONTHS, now), [now]);

  const [period, setPeriod] = useState<Period>("month");
  const [selected, setSelected] = useState<AccountSelection>(null);
  const range = useMemo(() => periodRange(period, now), [period, now]);

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
  // Money in and out for the picked period. Server-computed for the same reason
  // the reports screen does it that way: two clients deriving the same figure
  // independently is how they end up disagreeing.
  const flowQ = useCashFlow(range.from, range.to);

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

  // Where money actually sits. Income and expense accounts are categories, not
  // places, and putting them in the switcher would make "select an account to
  // filter" mean two different things in one list.
  const moneyAccounts = useMemo(
    () =>
      accountsQ.accounts.filter(
        (a) => !a.archived && (a.type === "asset" || a.type === "liability"),
      ),
    [accountsQ.accounts],
  );

  const exposure = useMemo(
    () => currencyExposure(accountsQ.accounts, balancesQ.balanceOf, base, fxQ.rates),
    [accountsQ.accounts, balancesQ.balanceOf, base, fxQ.rates],
  );

  const recent = useMemo(() => {
    const views = buildEntryViews(entriesQ.entries, entriesQ.lines, accountsQ.accounts);
    const forAccount = selected
      ? views.filter((v) => v.from?.id === selected || v.to?.id === selected)
      : views;
    return forAccount.slice(0, RECENT_COUNT);
  }, [entriesQ.entries, entriesQ.lines, accountsQ.accounts, selected]);

  const currencies = new Set(moneyAccounts.map((a) => a.currency)).size;
  const safe = safeToSpend(spending);
  const daysLeft = daysLeftInMonth(now);
  const selectedName = selected
    ? (moneyAccounts.find((a) => a.id === selected)?.name ?? "this account")
    : "all accounts";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-ink font-bold">Home</h1>
          <span className="text-body text-faint">
            {moneyAccounts.length} {moneyAccounts.length === 1 ? "account" : "accounts"} ·{" "}
            {currencies} {currencies === 1 ? "currency" : "currencies"} · base {base}
          </span>
        </div>
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
            void flowQ.refetch();
          }}
        />
      ) : null}

      <SetupChecklist />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {loading ? (
          <Card>
            <CardContent>
              <LoadingRows />
            </CardContent>
          </Card>
        ) : (
          // `self-start` so the panel keeps its natural height instead of
          // stretching to match the taller ledger column beside it.
          <AccountPanel
            className="self-start"
            accounts={moneyAccounts}
            balanceOf={balancesQ.balanceOf}
            base={base}
            rates={fxQ.rates}
            netTotal={worthQ.data?.net_minor ?? null}
            selected={selected}
            onSelect={setSelected}
          />
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-label text-faint font-semibold uppercase">
                Position
              </CardTitle>
              <SegmentedControl
                name="dashboard-period"
                label="Period for money in and out"
                value={period}
                options={PERIODS}
                onChange={setPeriod}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label={`${t("totalMoney")} · today`}>
                  {worthQ.isPending ? (
                    <LoadingRows rows={1} />
                  ) : (
                    <Amount
                      currency={worthQ.data?.base_currency ?? base}
                      minor={worthQ.data?.net_minor ?? null}
                      size="lg"
                    />
                  )}
                </Stat>
                <Stat label="Money in" divided>
                  {flowQ.isPending ? (
                    <LoadingRows rows={1} />
                  ) : (
                    <Amount
                      currency={base}
                      minor={flowQ.data?.income_minor.base_minor ?? null}
                      size="lg"
                      tone="flow"
                      showSign
                    />
                  )}
                </Stat>
                <Stat label="Money out" divided>
                  {flowQ.isPending ? (
                    <LoadingRows rows={1} />
                  ) : (
                    <Amount
                      currency={base}
                      minor={
                        flowQ.data ? -Math.abs(flowQ.data.expense_minor.base_minor) : null
                      }
                      size="lg"
                      showSign
                    />
                  )}
                </Stat>
              </div>

              <div className="border-outline-variant space-y-3 border-t pt-4">
                <span className="text-overline text-faint font-semibold tracking-wide uppercase">
                  Currency exposure
                </span>
                {loading ? <LoadingRows rows={2} /> : <CurrencyExposure exposure={exposure} base={base} />}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <div className="border-outline flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-headline text-ink font-semibold">Recent entries</span>
                <span className="text-caption text-faint">{selectedName} · newest first</span>
              </div>
              <Link to="/app/history" className="text-label text-info-strong hover:underline">
                See all
              </Link>
            </div>
            {loading ? (
              <div className="p-4">
                <LoadingRows />
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                icon={<TrendingUp className="size-7" strokeWidth={1.5} />}
                title={selected ? "Nothing on this account yet" : "No entries yet"}
                hint={
                  selected
                    ? "Pick another account, or record a move that touches this one."
                    : "Record a purchase or some income and your buckets fill in."
                }
                action={<AddEntryButton />}
              />
            ) : (
              <EntryTable views={recent} />
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {loading ? (
          <Card>
            <CardContent>
              <LoadingRows rows={2} />
            </CardContent>
          </Card>
        ) : (
          <SafeToSpendCard
            className="self-start"
            spending={spending}
            safe={safe}
            daysLeft={daysLeft}
            base={base}
          />
        )}

        <section className="min-w-0 space-y-3">
          <h2 className="text-headline text-ink font-semibold">{t("buckets")}</h2>
          {loading ? (
            <LoadingRows />
          ) : (
            <BucketList buckets={buckets} spending={spending} base={base} rates={fxQ.rates} />
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  divided = false,
  children,
}: {
  label: string;
  divided?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        divided
          ? "border-outline-variant flex flex-col gap-1.5 sm:border-l sm:pl-4"
          : "flex flex-col gap-1.5"
      }
    >
      <span className="text-caption text-faint">{label}</span>
      {children}
    </div>
  );
}
