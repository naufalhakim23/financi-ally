import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { authedApi, type CashFlow, type CategorySpend, type NetWorth } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { format } from "../../src/lib/money";
import { Card, IconBox, ProgressBar, SectionLabel } from "../../src/components/ui";

function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function monthEnd(d = new Date()): string {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function Reports() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";
  const [nw, setNw] = useState<NetWorth | null>(null);
  const [cf, setCf] = useState<CashFlow | null>(null);
  const [spending, setSpending] = useState<CategorySpend[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const from = monthStart();
  const to = monthEnd();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr(null);
      try {
        const [n, c, s] = await Promise.all([
          authedApi.getNetWorth(),
          authedApi.getCashFlow(from, to),
          authedApi.getSpending(from, to),
        ]);
        if (!cancelled) { setNw(n); setCf(c); setSpending(s); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "failed to load reports");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [from, to, user]);

  const maxSpend = spending.reduce((m, s) => Math.max(m, s.spent_minor), 0);

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

      {spending.length > 0 && (
        <Card padded={false}>
          <View className="px-4 pt-4 pb-2">
            <SectionLabel>Spending by category · {base}</SectionLabel>
          </View>
          {spending.map((s, i) => {
            const pct = maxSpend > 0 ? (s.spent_minor / maxSpend) * 100 : 0;
            const last = i === spending.length - 1;
            return (
              <View
                key={s.account_id}
                className={`flex-row items-center px-4 py-3 ${last ? "" : "border-b border-outline-variant"}`}
                style={{ gap: 10 }}
              >
                <IconBox bg="bg-secondary">💸</IconBox>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-ink text-[13px] font-sans-semibold" numberOfLines={1}>
                      {s.account_name}
                    </Text>
                    <Text className="text-ink text-[12px] font-mono-bold">
                      {format(s.currency, s.spent_minor)}
                    </Text>
                  </View>
                  <View className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                    <View className="h-2 rounded-full bg-info" style={{ width: `${pct}%` }} />
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {spending.length === 0 && !err && (
        <Card>
          <Text className="text-faint text-sm">No spending this month.</Text>
        </Card>
      )}
    </ScrollView>
  );
}
