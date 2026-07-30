import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { format } from "../../src/lib/money";
import { accountSigned, netWorth } from "../../src/lib/balances";
import { useObservable } from "../../src/lib/useObserve";
import { Account, Budget, Entry, JournalLine } from "../../src/model/models";
import { Amount, Card, IconBox, ProgressBar, SectionLabel } from "../../src/components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";

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

  const worth = netWorth(accounts, lines);
  const active = accounts.filter((a) => !a.archived);
  const recent = entries.slice(0, 8);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEntryIds = new Set(
    entries.filter((e) => {
      const d = new Date(e.txnDate);
      return d >= monthStart && d < monthEnd;
    }).map((e) => e.id),
  );
  const budgetRows = budgets
    .filter((b) => {
      const bd = new Date(b.periodMonth);
      return bd.getFullYear() === now.getFullYear() && bd.getMonth() === now.getMonth();
    })
    .map((b) => {
      const spent = lines
        .filter((l) => l.accountId === b.accountId && l.dc === "debit" && monthEntryIds.has(l.entryId))
        .reduce((s, l) => s + l.amountMinor, 0);
      return { id: b.id, accountId: b.accountId, target: b.targetMinor, spent, currency: b.currency };
    });
  const totalSpent = budgetRows.reduce((s, r) => s + r.spent, 0);
  const totalTarget = budgetRows.reduce((s, r) => s + r.target, 0);
  const budgetPct = totalTarget > 0 ? (totalSpent / totalTarget) * 100 : 0;
  const budgetBase = budgetRows.length > 0 ? budgetRows[0].currency : base;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }}
    >
      {/* Net worth hero */}
      <View className="px-4 mb-4">
        <SectionLabel>Net worth · {base}</SectionLabel>
        <Text className="text-ink text-[32px] font-mono-bold leading-tight mt-1">
          {format(base, worth)}
        </Text>
      </View>

      {/* New entry — primary action (prototype's FAB; deferred as nav change) */}
      <View className="px-4 mb-5">
        <Pressable
          onPress={() => router.push("/(app)/entry-new")}
          className="bg-primary rounded-xl py-4 items-center"
        >
          <Text className="text-on-primary font-sans-bold">＋ New entry</Text>
        </Pressable>
      </View>

      {/* Accounts strip */}
      <View className="mb-5">
        <View className="flex-row items-center justify-between px-4 mb-2">
          <SectionLabel>Accounts</SectionLabel>
          <Pressable onPress={() => router.push("/(app)/pockets")}>
            <Text className="text-[11px] font-sans-semibold text-info">See all</Text>
          </Pressable>
        </View>
        {active.length === 0 ? (
          <Text className="text-faint text-sm px-4">No accounts yet.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {active.map((a) => {
              const bal = accountSigned(a, lines);
              return (
                <View
                  key={a.id}
                  className="bg-surface rounded-xl border border-outline p-3 mr-2 w-32"
                >
                  <Text className="text-base mb-1">🏦</Text>
                  <Text className="text-faint text-[10px] font-sans-medium" numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text
                    className={`text-[13px] font-mono-bold ${
                      bal < 0 ? "text-error" : "text-ink"
                    }`}
                  >
                    {format(a.currency, bal)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Budget summary */}
      {budgetRows.length > 0 && (
        <View className="px-4 mb-5">
          <View className="flex-row items-center justify-between mb-2">
            <SectionLabel>Budget · {now.toLocaleString("default", { month: "long" })}</SectionLabel>
            <Pressable onPress={() => router.push("/(app)/budgets")}>
              <Text className="text-[11px] font-sans-semibold text-info">Details</Text>
            </Pressable>
          </View>
          <Card>
            <View className="flex-row items-end justify-between mb-2">
              <View>
                <Text className="text-faint text-[9px] font-sans-semibold uppercase tracking-widest">
                  Spent
                </Text>
                <Text className="text-ink text-[20px] font-mono-bold leading-tight mt-0.5">
                  {format(budgetBase, totalSpent)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-faint text-[9px] font-sans-semibold uppercase tracking-widest">
                  Budget
                </Text>
                <Text className="text-faint text-[16px] font-mono-bold leading-tight mt-0.5">
                  {format(budgetBase, totalTarget)}
                </Text>
              </View>
            </View>
            <ProgressBar pct={budgetPct} />
            <Text
              className={`text-[10px] font-mono-bold mt-1.5 ${
                budgetPct >= 100 ? "text-error" : budgetPct >= 75 ? "text-warning" : "text-success"
              }`}
            >
              {Math.round(budgetPct)}% used
            </Text>
          </Card>
        </View>
      )}

      {/* Recent */}
      <View className="px-4">
        <SectionLabel>Recent</SectionLabel>
        <View className="mt-2" />
        {recent.length === 0 ? (
          <Card>
            <Text className="text-faint text-sm">No entries yet. Add your first expense.</Text>
          </Card>
        ) : (
          <Card padded={false}>
            {recent.map((e, i) => {
              const debit = lines.find((l) => l.entryId === e.id && l.dc === "debit");
              const credit = lines.find((l) => l.entryId === e.id && l.dc === "credit");
              const last = i === recent.length - 1;
              return (
                <View
                  key={e.id}
                  className={`flex-row items-center px-4 py-3 ${last ? "" : "border-b border-outline-variant"}`}
                  style={{ gap: 12 }}
                >
                  <IconBox bg="bg-secondary">💸</IconBox>
                  <View className="flex-1 min-w-0">
                    <Text className="text-ink text-[13px] font-sans-medium" numberOfLines={1}>
                      {e.memo || "Entry"}
                    </Text>
                    <Text className="text-faint text-[10px]">
                      {accountName(credit?.accountId ?? "")} ·{" "}
                      {new Date(e.txnDate).toLocaleDateString()}
                    </Text>
                  </View>
                  {debit && <Amount minor={-debit.amountMinor} currency={e.currency} size="sm" />}
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
