import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import {
  authedApi,
  type CashFlow,
  type CategorySpend,
  type MonthlySeries,
  type NetWorth,
} from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { format } from "../../src/lib/money";
import { Card, EmptyState, SectionLabel, Skeleton } from "../../src/components/ui";
import { Donut, TrendBars, seriesColor } from "../../src/components/charts";

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

type Slice = { id: string; label: string; value: number; color: string };

function toSlices(spending: CategorySpend[]): Slice[] {
  const sorted = [...spending]
    .filter((s) => s.spent_minor > 0)
    .sort((a, b) => b.spent_minor - a.spent_minor);
  const head = sorted.slice(0, MAX_SLICES).map((s, i) => ({
    id: s.account_id,
    label: s.account_name,
    value: s.spent_minor,
    color: seriesColor(i),
  }));
  const rest = sorted.slice(MAX_SLICES);
  if (rest.length > 0) {
    head.push({
      id: "__other",
      label: `Other (${rest.length})`,
      value: rest.reduce((s, r) => s + r.spent_minor, 0),
      color: seriesColor(MAX_SLICES),
    });
  }
  return head;
}

export default function Reports() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";
  const [nw, setNw] = useState<NetWorth | null>(null);
  const [cf, setCf] = useState<CashFlow | null>(null);
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [series, setSeries] = useState<MonthlySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const from = monthStart();
  const to = monthEnd();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr(null);
      setLoading(true);
      try {
        const [n, c, s, m] = await Promise.all([
          authedApi.getNetWorth(),
          authedApi.getCashFlow(from, to),
          authedApi.getSpending(from, to),
          authedApi.getMonthlySeries(6),
        ]);
        if (!cancelled) { setNw(n); setCf(c); setSpending(s); setSeries(m); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [from, to, user]);

  const slices = toSlices(spending);
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
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      {err && (
        <Card className="mb-4">
          <Text className="text-error text-sm">{err}</Text>
        </Card>
      )}

      {loading ? (
        <>
          <Card className="mb-4">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-40" />
          </Card>
          <Card className="mb-4">
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
          <Card className="mb-4">
            <SectionLabel>Net worth · {nw?.base_currency ?? base}</SectionLabel>
            <Text className="text-ink text-[26px] font-mono-bold mt-1 leading-none">
              {format(nw?.base_currency ?? base, nw?.net_minor ?? 0)}
            </Text>
            <View className="flex-row mt-3" style={{ gap: 16 }}>
              <View className="flex-1">
                <Text className="text-faint text-[9px] font-sans-semibold uppercase tracking-widest">
                  Assets
                </Text>
                <Text className="text-success text-[15px] font-mono-bold mt-0.5">
                  {format(nw?.total_asset.currency ?? base, nw?.total_asset.base_minor ?? 0)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-faint text-[9px] font-sans-semibold uppercase tracking-widest">
                  Liabilities
                </Text>
                <Text className="text-error text-[15px] font-mono-bold mt-0.5">
                  {format(nw?.total_liability.currency ?? base, nw?.total_liability.base_minor ?? 0)}
                </Text>
              </View>
            </View>
          </Card>

          {trend.length > 0 && (
            <Card className="mb-4">
              <SectionLabel>Monthly spend · {series?.base_currency ?? base}</SectionLabel>
              <View className="mt-3">
                <TrendBars
                  points={trend}
                  formatValue={(v) => `${format(series?.base_currency ?? base, v)}`}
                />
              </View>
            </Card>
          )}

          {cf && (
            <Card className="mb-4">
              <SectionLabel>Cash flow · {base}</SectionLabel>
              <View className="flex-row mt-2" style={{ gap: 16 }}>
                <View className="flex-1">
                  <Text className="text-faint text-[9px] font-sans-semibold uppercase tracking-widest">
                    Income
                  </Text>
                  <Text className="text-success text-[15px] font-mono-bold mt-0.5">
                    {format(cf.income_minor.currency, cf.income_minor.base_minor)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-faint text-[9px] font-sans-semibold uppercase tracking-widest">
                    Expenses
                  </Text>
                  <Text className="text-error text-[15px] font-mono-bold mt-0.5">
                    {format(cf.expense_minor.currency, cf.expense_minor.base_minor)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-faint text-[9px] font-sans-semibold uppercase tracking-widest">
                    Net
                  </Text>
                  <Text
                    className={`text-[15px] font-mono-bold mt-0.5 ${
                      cf.net_minor >= 0 ? "text-success" : "text-error"
                    }`}
                  >
                    {format(base, cf.net_minor)}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {slices.length > 0 ? (
            <Card>
              <SectionLabel>Spending by category · {base}</SectionLabel>
              <View className="items-center mt-4 mb-2">
                <Donut
                  slices={slices}
                  center={
                    <View className="items-center">
                      <Text className="text-faint text-[9px] font-sans-semibold uppercase tracking-widest">
                        Total
                      </Text>
                      <Text className="text-ink text-[14px] font-mono-bold">
                        {format(base, totalSpent)}
                      </Text>
                    </View>
                  }
                />
              </View>
              {/* Legend doubles as the value table — the ramp's low-contrast
                  slots are only legal alongside visible labels. */}
              <View className="mt-2">
                {slices.map((s) => {
                  const pct = totalSpent > 0 ? Math.round((s.value / totalSpent) * 100) : 0;
                  return (
                    <View key={s.id} className="flex-row items-center py-2" style={{ gap: 10 }}>
                      <View
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <Text
                        className="flex-1 text-ink text-[13px] font-sans-medium"
                        numberOfLines={1}
                      >
                        {s.label}
                      </Text>
                      <Text className="text-faint text-[11px] font-mono-medium">{pct}%</Text>
                      <Text className="text-ink text-[12px] font-mono-bold">
                        {format(base, s.value)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : (
            !err && (
              <EmptyState
                icon="📊"
                title="Nothing to report yet"
                body="Log an expense and this month's breakdown shows up here."
                actionLabel="Add an entry"
                onAction={() => router.push("/(app)/entry-new")}
              />
            )
          )}
        </>
      )}
    </ScrollView>
  );
}
