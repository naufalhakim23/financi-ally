import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, TriangleAlert } from "lucide-react-native";

import { authedApi } from "../../../src/lib/api";
import { useAuth } from "../../../src/lib/auth";
import { accountSigned, netWorth } from "../../../src/lib/balances";
import {
  buildBuckets,
  daysLeftInMonth,
  safeToSpend,
  spendingForMonth,
} from "../../../src/lib/buckets";
import { database } from "../../../src/lib/db";
import { EMPTY_RATES, convert, rateCaption, type RateTable } from "../../../src/lib/fx";
import { useLedgerState } from "../../../src/lib/ledgerStore";
import { useSyncState } from "../../../src/lib/syncState";
import { useObservable } from "../../../src/lib/useObserve";
import { useSyncRefresh } from "../../../src/lib/useSyncRefresh";
import { useWording } from "../../../src/lib/wording";
import { SetupChecklist } from "../../../src/components/setup-checklist";
import { Account, Budget, Entry, JournalLine } from "../../../src/model/models";
import {
  Amount,
  Badge,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ListRow,
  SectionLabel,
  TrendBars,
  Wallet,
  accountGlyph,
  formatGrouped,
  ICON,
  useTheme,
} from "../../../src/components/ui";

type Range = "6M" | "1Y" | "All";
const RANGE_MONTHS: Record<Range, number> = { "6M": 6, "1Y": 12, All: 36 };

export default function HomeScreen() {
  const { user, guest, baseCurrency: base } = useAuth();
  const { t } = useWording();
  const { C } = useTheme();
  const sync = useSyncState();
  const { active } = useLedgerState();
  const [range, setRange] = useState<Range>("1Y");

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const linesObs = useMemo(() => database.get<JournalLine>("journal_lines").query().observe(), []);
  const entriesObs = useMemo(
    () => database.get<Entry>("entries").query().observeWithColumns(["txn_date"]),
    [],
  );
  const budgetsObs = useMemo(() => database.get<Budget>("budgets").query().observe(), []);
  const accounts = useObservable(accountsObs, [] as Account[]);
  const lines = useObservable(linesObs, [] as JournalLine[]);
  const entries = useObservable(entriesObs, [] as Entry[]);
  const budgets = useObservable(budgetsObs, [] as Budget[]);

  // FX and the monthly series are server reads. Both are display-only here, so
  // a failure degrades the card rather than blocking the screen — and a guest
  // has no token at all, so they never run.
  const ratesQuery = useQuery({
    queryKey: ["fx-rates"],
    queryFn: () => authedApi.listFxRates(),
    staleTime: 30 * 60 * 1000,
    enabled: !guest,
  });
  const rates: RateTable = ratesQuery.data
    ? { rates: ratesQuery.data.rates ?? [], asOf: ratesQuery.data.as_of ?? null }
    : EMPTY_RATES;

  const seriesQuery = useQuery({
    queryKey: ["monthly", RANGE_MONTHS[range]],
    queryFn: () => authedApi.getMonthlySeries(RANGE_MONTHS[range]),
    staleTime: 10 * 60 * 1000,
    enabled: !guest,
  });

  // The net-worth card mixes local balances with two server reads, so the pull
  // gesture has to refetch those as well or half the card stays stale.
  const refetchServerReads = useCallback(
    () => Promise.all([ratesQuery.refetch(), seriesQuery.refetch()]),
    [ratesQuery.refetch, seriesQuery.refetch],
  );
  const pull = useSyncRefresh(refetchServerReads);

  const worth = netWorth(accounts, lines);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEntryIds = new Set(
    entries
      .filter((e) => {
        const d = new Date(e.txnDate);
        return d >= monthStart && d < monthEnd;
      })
      .map((e) => e.id),
  );
  const spendingRows = spendingForMonth(accounts, lines, monthEntryIds, budgets, base, monthStart);
  const buckets = buildBuckets(accounts, (a) => accountSigned(a, lines), base, rates, spendingRows);
  const safe = safeToSpend(spendingRows);

  const points = seriesQuery.data?.points ?? [];

  /**
   * Net worth per month, walked backwards from today's figure: the balance at
   * the end of month i is today's balance less every month's net since. The
   * server has no net-worth-over-time endpoint, and this needs no new one.
   */
  const worthSeries = useMemo(() => {
    if (points.length === 0) return [];
    const out: { key: string; label: string; value: number; emphasized?: boolean }[] = [];
    let running = worth;
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      out.unshift({
        key: p.month,
        label: new Date(p.month).toLocaleDateString(undefined, { month: "short" }),
        value: running,
        emphasized: i === points.length - 1,
      });
      running -= p.net_minor;
    }
    // Bars are drawn from zero, so a series that never dips near zero looks
    // flat. Rebase to the smallest point so the shape of the change is visible.
    const min = Math.min(...out.map((o) => o.value));
    const floor = min > 0 ? min * 0.92 : min;
    return out.map((o) => ({ ...o, value: o.value - floor }));
  }, [points, worth]);

  const thisMonthNet = points.length > 0 ? points[points.length - 1].net_minor : 0;
  const prevWorth = worth - thisMonthNet;
  const pct = prevWorth !== 0 ? (thisMonthNet / Math.abs(prevWorth)) * 100 : 0;

  const rangeCaption =
    points.length > 0
      ? `${new Date(points[0].month).toLocaleDateString(undefined, { month: "short", year: "2-digit" })} — ${new Date(
          points[points.length - 1].month,
        ).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}`
      : "";

  // A foreign holding is the only reason to state a rate, so the caption
  // follows the first foreign currency the user actually holds.
  const foreignCurrency = buckets.find((b) => b.id === "foreign")?.children[0]?.account.currency;
  const fxCaption = foreignCurrency ? rateCaption(foreignCurrency, base, rates) : null;

  // The same figure in the currency the user actually thinks in abroad. Only
  // shown when there is a foreign holding and a rate path for it.
  const worthAbroad = foreignCurrency ? convert(worth, base, foreignCurrency, rates) : null;

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  // First run: a zeroed home tells a new user nothing. Send them to setup,
  // which builds a whole starter chart rather than a single pocket.
  if (accounts.length === 0) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background justify-center px-4">
        <EmptyState
          glyph={Wallet}
          title="Set up your money"
          body="Pick the pockets you keep money in and the things you spend it on. Takes a minute."
          actionLabel="Get started"
          onAction={() => router.push("/(app)/setup")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3.5">
        <Pressable
          onPress={() => router.push("/(app)/ledgers")}
          accessibilityRole="button"
          accessibilityLabel={`Book: ${active?.name ?? "Personal"}. Change book`}
          className="flex-row items-center bg-secondary rounded-full px-3 py-2 min-h-touch"
          style={{ gap: 6 }}
        >
          <Text className="text-label font-sans-semibold text-on-secondary" numberOfLines={1}>
            {active?.name ?? "Personal"}
          </Text>
          <ChevronDown size={ICON.sm} color={C.dim} strokeWidth={2} />
        </Pressable>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <IconButton
            glyph={Search}
            label="Search"
            onPress={() =>
              router.push({
                pathname: "/(app)/(tabs)/history",
                // Nonce: the tab stays mounted, so a fresh value is what tells
                // it to re-open the box after a previous dismiss.
                params: { search: String(Date.now()) },
              })
            }
          />
          <View className="w-10 h-10 rounded-full bg-surface-container-high items-center justify-center">
            <Text className="text-label font-sans-semibold text-dim">{initials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={pull ? <RefreshControl {...pull} tintColor={C.dim} /> : undefined}
      >
        {/* Fed from this screen's observables: the checklist asks the same
            three tables, and its own subscriptions doubled the work here. */}
        <SetupChecklist accounts={accounts} entries={entries} lines={lines} />

        <Card>
          <View className="flex-row items-center justify-between">
            <SectionLabel>
              {t("totalMoney")} · {base}
            </SectionLabel>
            {sync.status === "error" && (
              <Badge tone="warning" glyph={TriangleAlert}>
                offline
              </Badge>
            )}
          </View>

          <Text className="text-amount-hero font-mono-bold text-ink mt-2">
            {formatGrouped(base, worth)}
          </Text>
          <View className="flex-row items-baseline mt-1" style={{ gap: 8 }}>
            <Text
              className={`text-amount-sm font-mono-medium ${
                thisMonthNet < 0 ? "text-error-strong" : "text-success-strong"
              }`}
            >
              {thisMonthNet < 0 ? "−" : "+"}
              {formatGrouped(base, thisMonthNet)}
            </Text>
            <Text className="text-caption font-sans-medium text-faint">
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(1)}% this month
              {worthAbroad != null && foreignCurrency
                ? ` · ≈ ${foreignCurrency} ${formatGrouped(foreignCurrency, worthAbroad)}`
                : ""}
            </Text>
          </View>

          {worthSeries.length > 0 && (
            <View className="mt-3.5">
              <TrendBars points={worthSeries} height={64} gap={4} showLabels={false} />
            </View>
          )}

          <View className="flex-row items-center justify-between mt-3.5">
            <View className="flex-row" style={{ gap: 6 }}>
              {(["6M", "1Y", "All"] as Range[]).map((r) => (
                <Chip key={r} label={r} active={r === range} onPress={() => setRange(r)} />
              ))}
            </View>
            {!!rangeCaption && (
              <Text className="text-mono-meta font-mono text-faint">{rangeCaption}</Text>
            )}
          </View>

          {fxCaption && (
            <>
              <View className="h-px bg-outline-variant my-3.5" />
              <Text className="text-mono-meta font-mono text-faint">{fxCaption}</Text>
            </>
          )}
        </Card>

        <View className="flex-row items-center justify-between mt-1">
          <SectionLabel>{t("buckets")}</SectionLabel>
          <Text
            className="text-label font-sans-semibold text-info"
            onPress={() => router.push("/(app)/(tabs)/buckets")}
          >
            Manage
          </Text>
        </View>

        <Card padded={false}>
          {buckets
            .filter((b) => b.children.length > 0 || b.id === "spending")
            .map((b, i) => (
              <ListRow
                key={b.id}
                divider={i > 0}
                glyph={accountGlyph(b.title, b.id === "owed" ? "liability" : "asset")}
                slot={b.slot}
                title={b.title}
                subtitle={b.subtitle}
                subtitleTone={b.converted ? "warning" : "faint"}
                amount={b.total ?? 0}
                currency={base}
                amountTone="neutral"
                meta={
                  b.total == null
                    ? "rate unavailable"
                    : b.children.length > 1
                      ? b.children
                          .slice(0, 2)
                          .map((c) => `${c.account.currency} ${formatGrouped(c.account.currency, c.balance)}`)
                          .join(" · ")
                      : undefined
                }
                chevron
                onPress={() => router.push("/(app)/(tabs)/buckets")}
              />
            ))}
        </Card>

        <Card>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="flex-1">
              <Text className="text-body-strong font-sans-semibold text-ink">{t("safeToSpend")}</Text>
              <Text className="text-caption font-sans-medium text-faint mt-0.5">
                {daysLeftInMonth(now)} days left in{" "}
                {now.toLocaleDateString(undefined, { month: "long" })}
              </Text>
            </View>
            <Amount minor={safe} currency={base} size="lg" tone="neutral" />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
