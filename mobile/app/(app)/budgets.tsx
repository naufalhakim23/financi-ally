import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { authedApi, type BudgetWithSpent } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { format } from "../../src/lib/money";
import { useObservable } from "../../src/lib/useObserve";
import { Account } from "../../src/model/models";
import { Card, IconBox, ProgressBar, SectionLabel } from "../../src/components/ui";

// Current month as YYYY-MM-01 (server expects month-start).
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function Budgets() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";
  const period = currentMonth();
  const [items, setItems] = useState<BudgetWithSpent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const accounts = useObservable(accountsObs, [] as Account[]);

  // Spent is a server-computed rollup over posted lines; fetch on focus + after
  // a local sync may have pushed new entries. Local WMB holds the budget rows;
  // this read pulls the live spent total.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const bs = await authedApi.listBudgets(period);
        if (!cancelled) setItems(bs);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "failed to load budgets");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, user]);

  const nameFor = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";

  const spentTotal = items.reduce((s, b) => s + b.spent_minor, 0);
  const targetTotal = items.reduce((s, b) => s + b.target_minor, 0);
  const overallPct = targetTotal > 0 ? (spentTotal / targetTotal) * 100 : 0;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      {/* Summary */}
      <Card className="mb-4">
        <View className="flex-row items-end justify-between mb-3">
          <View>
            <SectionLabel>Total spent</SectionLabel>
            <Text className="text-ink text-[26px] font-mono-bold mt-1 leading-none">
              {format(base, spentTotal)}
            </Text>
          </View>
          <View className="items-end">
            <SectionLabel>Budget</SectionLabel>
            <Text className="text-faint text-[20px] font-mono-bold mt-1 leading-none">
              {format(base, targetTotal)}
            </Text>
          </View>
        </View>
        <ProgressBar pct={overallPct} />
        <View className="flex-row justify-between mt-2">
          <Text
            className={`text-[10px] font-mono-bold ${
              overallPct >= 100 ? "text-error" : overallPct >= 75 ? "text-warning" : "text-success"
            }`}
          >
            {Math.round(overallPct)}% used
          </Text>
          <Text className="text-[10px] font-mono text-faint">{period.slice(0, 7)}</Text>
        </View>
      </Card>

      {err && (
        <Card className="mb-4">
          <Text className="text-error text-sm">{err}</Text>
        </Card>
      )}

      {items.length === 0 && !err && (
        <Card>
          <Text className="text-faint text-sm">No budgets for this month.</Text>
        </Card>
      )}

      {/* Category list */}
      {items.length > 0 && (
        <Card padded={false}>
          {items.map((b, i) => {
            const pct = b.target_minor > 0 ? (b.spent_minor / b.target_minor) * 100 : 0;
            const last = i === items.length - 1;
            return (
              <View
                key={b.id}
                className={`px-4 py-3.5 ${last ? "" : "border-b border-outline-variant"}`}
              >
                <View className="flex-row items-center mb-2" style={{ gap: 10 }}>
                  <IconBox bg="bg-secondary">💸</IconBox>
                  <View className="flex-1">
                    <Text className="text-ink text-[13px] font-sans-semibold">
                      {nameFor(b.account_id)}
                    </Text>
                    <Text className="text-faint text-[10px] font-mono">
                      {format(b.currency, b.spent_minor)} / {format(b.currency, b.target_minor)}
                    </Text>
                  </View>
                  <Text
                    className={`text-[12px] font-mono-bold ${
                      pct >= 100 ? "text-error" : pct >= 75 ? "text-warning" : "text-success"
                    }`}
                  >
                    {Math.round(pct)}%
                  </Text>
                </View>
                <ProgressBar pct={pct} />
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}
