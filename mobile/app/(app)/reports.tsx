import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import {
  authedApi,
  type CashFlow,
  type CategorySpend,
  type MonthlySeries,
  type NetWorth,
} from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { useStrings } from "../../src/lib/wording";
import {
  BarChart3,
  Card,
  ChartLegend,
  Donut,
  EmptyState,
  ErrorNotice,
  SectionLabel,
  Skeleton,
  TrendBars,
  formatGrouped,
  seriesColor,
  ScreenHeader,
  useTheme,
} from "../../src/components/ui";
import { messageFor } from "../../src/lib/errors";
import type { Strings } from "../../src/lib/wording";

function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function monthEnd(d = new Date()): string {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

// Categories past the ramp collapse into one "Other" slice — a donut with 15
// wedges is a color lookup puzzle, not a chart.
const MAX_SLICES = 7;

type Slice = { id: string; label: string; value: number; color: string; note?: string };

function toSlices(spending: CategorySpend[], s: Strings): Slice[] {
  const sorted = [...spending]
    .filter((x) => x.spent_minor > 0)
    .sort((a, b) => b.spent_minor - a.spent_minor);
  const head: Slice[] = sorted.slice(0, MAX_SLICES).map((x, i) => ({
    id: x.account_id,
    label: x.account_name,
    value: x.spent_minor,
    color: seriesColor(i),
  }));
  const rest = sorted.slice(MAX_SLICES);
  if (rest.length > 0) {
    head.push({
      id: "__other",
      label: s.reports.otherSlice,
      note: s.reports.otherSliceCount(rest.length),
      value: rest.reduce((sum, r) => sum + r.spent_minor, 0),
      color: seriesColor(MAX_SLICES),
    });
  }
  return head;
}

export default function Reports() {
  const { user, baseCurrency: base } = useAuth();
  const s = useStrings();
  const { C } = useTheme();
  const [nw, setNw] = useState<NetWorth | null>(null);
  const [cf, setCf] = useState<CashFlow | null>(null);
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [series, setSeries] = useState<MonthlySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const from = monthStart();
  const to = monthEnd();

  // Every load takes a ticket; only the newest may write. Without this, a slow
  // response lands the previous account's figures on the next one's screen.
  const gen = useRef(0);

  const load = useCallback(async () => {
    const mine = ++gen.current;
    setErr(null);
    try {
      const [n, c, s, m] = await Promise.all([
        authedApi.getNetWorth(),
        authedApi.getCashFlow(from, to),
        authedApi.getSpending(from, to),
        authedApi.getMonthlySeries(6),
      ]);
      if (mine !== gen.current) return;
      setNw(n);
      setCf(c);
      setSpending(s);
      setSeries(m);
    } catch (e) {
      if (mine === gen.current) setErr(messageFor(e, s.reports.loadFailed));
    }
  }, [from, to, s]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      gen.current++; // retire whatever is still in flight
    };
  }, [load, user]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const slices = toSlices(spending, s);
  const totalSpent = slices.reduce((s, x) => s + x.value, 0);
  const currentMonthKey = monthStart();
  const trend = (series?.points ?? []).map((p) => {
    // p.month is a plain YYYY-MM-DD date. `new Date("2026-07-01")` parses as UTC
    // midnight, which lands in the *previous* month for viewers west of UTC —
    // so build the label from the parts instead of from a Date's local getters.
    const [y, m] = p.month.split("-").map(Number);
    return {
      key: p.month,
      label: new Date(y, m - 1, 1).toLocaleString("default", { month: "short" }),
      value: p.expense_minor,
      emphasized: p.month === currentMonthKey,
    };
  });

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title={s.reports.title}
        backLabel={s.reports.backLabel}
        backAccessibilityLabel={s.common.backTo(s.reports.backLabel)}
        onBack={() => router.back()}
      />
      <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.dim} />
      }
    >
      {err && (
        <View className="mb-card-gap">
          <ErrorNotice message={err} onRetry={() => void load()} />
        </View>
      )}

      {loading ? (
        <>
          <Card className="mb-card-gap">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-40" />
          </Card>
          <Card className="mb-card-gap">
            <Skeleton className="h-3 w-28 mb-3" />
            <Skeleton className="h-20 w-full" />
          </Card>
          <Card>
            <Skeleton className="h-3 w-32 mb-3" />
            <Skeleton className="h-36 w-full" />
          </Card>
        </>
      ) : (
        <>
          {cf && (
            <Card hero className="mb-card-gap">
              <SectionLabel>{s.reports.withCurrency(s.reports.cashFlow, base)}</SectionLabel>
              {/* In and out are a pair, so they share a row; net is the
                  conclusion drawn from them and sits under the rule. */}
              <View className="flex-row pb-4 mt-3" style={{ gap: 16 }}>
                <View className="flex-1">
                  <SectionLabel>{s.reports.income}</SectionLabel>
                  <Text className="text-success-strong text-amount font-mono-bold mt-1">
                    {cf.income_minor.currency}&nbsp;
                    {formatGrouped(cf.income_minor.currency, cf.income_minor.base_minor)}
                  </Text>
                </View>
                <View className="flex-1">
                  <SectionLabel>{s.reports.expenses}</SectionLabel>
                  <Text className="text-error-strong text-amount font-mono-bold mt-1">
                    {cf.expense_minor.currency}&nbsp;
                    {formatGrouped(cf.expense_minor.currency, cf.expense_minor.base_minor)}
                  </Text>
                </View>
              </View>
              <View className="h-px bg-outline-variant" />
              <View className="flex-row items-center justify-between pt-4">
                <Text className="text-body-strong font-sans-semibold text-dim">{s.reports.net}</Text>
                <Text
                  className={`text-amount-lg font-mono-bold ${
                    cf.net_minor >= 0 ? "text-success-strong" : "text-error-strong"
                  }`}
                >
                  {base}&nbsp;{formatGrouped(base, cf.net_minor)}
                </Text>
              </View>
            </Card>
          )}

          <Card className="mb-card-gap">
            <SectionLabel>
              {s.reports.withCurrency(s.reports.netWorth, nw?.base_currency ?? base)}
            </SectionLabel>
            <Text className="text-ink text-amount-lg font-mono-bold mt-1">
              {nw?.base_currency ?? base}&nbsp;
              {formatGrouped(nw?.base_currency ?? base, nw?.net_minor ?? 0)}
            </Text>
            <View className="flex-row mt-3" style={{ gap: 16 }}>
              <View className="flex-1">
                <SectionLabel>{s.reports.assets}</SectionLabel>
                <Text className="text-success text-amount font-mono-bold mt-1">
                  {nw?.total_asset.currency ?? base}&nbsp;
                  {formatGrouped(nw?.total_asset.currency ?? base, nw?.total_asset.base_minor ?? 0)}
                </Text>
              </View>
              <View className="flex-1">
                <SectionLabel>{s.reports.liabilities}</SectionLabel>
                <Text className="text-error text-amount font-mono-bold mt-1">
                  {nw?.total_liability.currency ?? base}&nbsp;
                  {formatGrouped(
                    nw?.total_liability.currency ?? base,
                    nw?.total_liability.base_minor ?? 0,
                  )}
                </Text>
              </View>
            </View>
          </Card>

          {slices.length > 0 ? (
            <Card className="mb-card-gap">
              <SectionLabel>
                {s.reports.withCurrency(s.reports.spendingByCategory, base)}
              </SectionLabel>
              {/* Ring and legend side by side: the legend doubles as the value
                  table, and the ramp's low-contrast slots are only legal
                  alongside visible labels. The share column goes to make room. */}
              <View className="flex-row items-center mt-4" style={{ gap: 16 }}>
                <Donut
                  slices={slices}
                  size={128}
                  thickness={20}
                  center={
                    <View className="items-center px-2">
                      <SectionLabel>{s.reports.total}</SectionLabel>
                      <Text
                        className="text-ink text-amount-sm font-mono-bold mt-0.5"
                        numberOfLines={1}
                      >
                        {formatGrouped(base, totalSpent)}
                      </Text>
                    </View>
                  }
                />
                <View className="flex-1 min-w-0">
                  <ChartLegend
                    items={slices}
                    showShare={false}
                    formatValue={(v) => formatGrouped(base, v)}
                  />
                </View>
              </View>
            </Card>
          ) : (
            !err && (
              <EmptyState
                glyph={BarChart3}
                title={s.reports.empty.title}
                body={s.reports.empty.body}
                actionLabel={s.reports.empty.action}
                onAction={() => router.push("/(app)/entry-new")}
              />
            )
          )}

          {trend.length > 0 && (
            <Card className="mb-card-gap">
              <SectionLabel>
                {s.reports.withCurrency(s.reports.monthlySpend, series?.base_currency ?? base)}
              </SectionLabel>
              <View className="mt-3">
                <TrendBars
                  points={trend}
                  formatValue={(v) => formatGrouped(series?.base_currency ?? base, v)}
                />
              </View>
            </Card>
          )}
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}
