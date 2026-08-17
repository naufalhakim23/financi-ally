import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronDown, PieChart, Repeat, Search, TriangleAlert } from "lucide-react-native";

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
import { EMPTY_RATES, ageHours, convert, rateCaption, type RateTable } from "../../../src/lib/fx";
import { daysLoggedLastWeek, loggedEntries, momentFor } from "@financially/domain/moments";
import { useLedgerState } from "../../../src/lib/ledgerStore";
import { useSyncState } from "../../../src/lib/syncState";
import { useObservable } from "../../../src/lib/useObserve";
import { useSyncRefresh } from "../../../src/lib/useSyncRefresh";
import { useStrings, useWording } from "../../../src/lib/wording";
import { SetupChecklist } from "../../../src/components/setup-checklist";
import { Account, Budget, Entry, JournalLine } from "../../../src/model/models";
import {
  Amount,
  AnimatedPressable,
  Badge,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ListRow,
  ProgressBar,
  SectionLabel,
  Skeleton,
  TrendBars,
  Wallet,
  accountGlyph,
  formatGrouped,
  ICON,
  usePressedScale,
  useTheme,
  useValueFade,
  type Glyph,
} from "../../../src/components/ui";

type Range = "6M" | "1Y" | "All";
const RANGE_MONTHS: Record<Range, number> = { "6M": 6, "1Y": 12, All: 36 };

// Rates refresh daily; past this every converted figure is worth a caveat.
const STALE_RATE_HOURS = 24;

export default function HomeScreen() {
  const { user, guest, baseCurrency: base } = useAuth();
  const { t } = useWording();
  const s = useStrings();
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
  const worthFade = useValueFade(worth);

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
  const safeFade = useValueFade(safe);

  // Three categories closest to (or past) target.
  const planPeek = spendingRows
    .filter((r) => r.target != null && r.target > 0)
    .sort((a, b) => b.spent / (b.target ?? 1) - a.spent / (a.target ?? 1))
    .slice(0, 3);

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

  // Anything needing attention takes the greeting's slot.
  const hour = now.getHours();
  const greeting =
    hour < 12 ? s.home.greeting.morning : hour < 18 ? s.home.greeting.afternoon : s.home.greeting.evening;
  const rateAge = ageHours(rates);
  const opener =
    sync.status === "error"
      ? s.home.status.offline
      : fxCaption && rateAge != null && rateAge > STALE_RATE_HOURS
        ? s.home.status.staleRates
        : greeting;

  // No memo: `spendingRows` is rebuilt each render, so a cache on it never hits.
  const logged = loggedEntries(
    entries,
    lines,
    new Set(accounts.filter((a) => a.type === "equity").map((a) => a.id)),
  );
  const moment = momentFor({
    entryCount: logged.length,
    daysLoggedLastWeek: daysLoggedLastWeek(
      logged.map((e) => new Date(e.txnDate).getTime()),
      now,
    ),
    dayOfMonth: now.getDate(),
    daysLeftInMonth: daysLeftInMonth(now),
    plannedMinor: spendingRows.reduce((sum, r) => sum + (r.target ?? 0), 0),
    spentMinor: spendingRows.reduce((sum, r) => sum + r.spent, 0),
    safeToSpendMinor: safe,
  });

  // First run: a zeroed home tells a new user nothing. Send them to setup,
  // which builds a whole starter chart rather than a single pocket.
  if (accounts.length === 0) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background justify-center px-4">
        <EmptyState
          glyph={Wallet}
          title={s.home.firstRun.title}
          body={s.home.firstRun.body}
          actionLabel={s.home.firstRun.action}
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
          accessibilityLabel={s.home.bookSwitcher(active?.name ?? s.common.personalSpace)}
          className="flex-row items-center bg-secondary rounded-full px-3 py-2 min-h-touch"
          style={{ gap: 6 }}
        >
          <Text className="text-label font-sans-semibold text-on-secondary" numberOfLines={1}>
            {active?.name ?? s.common.personalSpace}
          </Text>
          <ChevronDown size={ICON.sm} color={C.dim} strokeWidth={2} />
        </Pressable>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <IconButton
            glyph={Search}
            label={s.home.search}
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

        <Text className="text-body font-sans-medium text-dim px-1">{opener}</Text>

        <Card>
          <View className="flex-row items-center justify-between">
            <SectionLabel>
              {t("totalMoney")} · {base}
            </SectionLabel>
            {sync.status === "error" && (
              <Badge tone="warning" glyph={TriangleAlert}>
                {s.home.offline}
              </Badge>
            )}
          </View>

          <Animated.View style={worthFade}>
            <Text className="text-amount-hero font-mono-bold text-ink mt-2">
              {formatGrouped(base, worth)}
            </Text>
          </Animated.View>
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
              {s.home.changeThisMonth(pct)}
              {worthAbroad != null && foreignCurrency
                ? ` · ≈ ${foreignCurrency} ${formatGrouped(foreignCurrency, worthAbroad)}`
                : ""}
            </Text>
          </View>

          {worthSeries.length > 0 ? (
            <View className="mt-3.5">
              <TrendBars points={worthSeries} height={64} gap={4} showLabels={false} />
            </View>
          ) : seriesQuery.isLoading && !guest ? (
            // Only the server-fed trend pulses; local figures already painted.
            <View className="mt-3.5">
              <Skeleton className="h-16 w-full" />
            </View>
          ) : null}

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
            {s.home.manage}
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
                    ? s.home.rateUnavailable
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
                {s.home.daysLeft(
                  daysLeftInMonth(now),
                  now.toLocaleDateString(undefined, { month: "long" }),
                )}
              </Text>
            </View>
            <Animated.View style={safeFade}>
              <Amount minor={safe} currency={base} size="lg" tone="neutral" />
            </Animated.View>
          </View>
          {moment && (
            <Text className="text-caption font-sans-medium text-dim mt-3">
              {s.moments[moment]}
            </Text>
          )}
        </Card>

        {/* One-tap peek at the plan; full screen lives under More. */}
        {planPeek.length > 0 && (
          <>
            <View className="flex-row items-center justify-between mt-1">
              <SectionLabel>{s.home.planLabel}</SectionLabel>
              <Text
                className="text-label font-sans-semibold text-info"
                onPress={() => router.push("/(app)/budgets")}
              >
                {s.home.seeAll}
              </Text>
            </View>
            <Card>
              <View style={{ gap: 12 }}>
                {planPeek.map((r) => {
                  const used = r.target ? Math.round((r.spent / r.target) * 100) : 0;
                  return (
                    <View key={r.account.id} style={{ gap: 6 }}>
                      <View className="flex-row items-baseline justify-between">
                        <Text className="text-body font-sans-medium text-ink" numberOfLines={1}>
                          {r.account.name}
                        </Text>
                        <Text className="text-mono-meta font-mono text-faint">
                          {s.home.planProgress(
                            formatGrouped(base, r.spent),
                            formatGrouped(base, r.target ?? 0),
                          )}
                        </Text>
                      </View>
                      <ProgressBar pct={used} />
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        )}

        <View className="flex-row mt-1" style={{ gap: 8 }}>
          <QuickAction
            glyph={PieChart}
            label={s.home.quick.plan}
            onPress={() => router.push(guest ? "/register" : "/(app)/budgets")}
          />
          <QuickAction
            glyph={BarChart3}
            label={s.home.quick.reports}
            onPress={() => router.push(guest ? "/register" : "/(app)/reports")}
          />
          <QuickAction
            glyph={Repeat}
            label={s.home.quick.repeating}
            onPress={() => router.push(guest ? "/register" : "/(app)/recurring")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ glyph: G, label, onPress }: { glyph: Glyph; label: string; onPress: () => void }) {
  const { C, ELEVATION } = useTheme();
  const { pressed, pressStyle, handlers } = usePressedScale("tap");
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...handlers}
      className={`flex-1 items-center rounded-2xl border border-outline py-3 ${
        pressed ? "bg-surface-pressed" : "bg-surface"
      }`}
      style={[ELEVATION.card, pressStyle, { gap: 6 }]}
    >
      <G size={ICON.xl} color={C.dim} strokeWidth={1.75} />
      <Text className="text-label font-sans-semibold text-ink">{label}</Text>
    </AnimatedPressable>
  );
}
