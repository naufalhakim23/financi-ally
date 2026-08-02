import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { format } from "../../src/lib/money";
import { accountSigned, netWorth } from "../../src/lib/balances";
import { useObservable } from "../../src/lib/useObserve";
import { Account, Budget, Entry, JournalLine } from "../../src/model/models";
import {
  Amount,
  Button,
  Card,
  EmptyState,
  ListRow,
  ProgressBar,
  Receipt,
  SectionLabel,
  Wallet,
  accountGlyph,
  categorySlot,
} from "../../src/components/ui";

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
  const accountFor = (id: string) => accounts.find((a) => a.id === id);

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

  // First run: a zeroed dashboard tells a new user nothing. Send them to the
  // one action that makes every other screen work.
  if (accounts.length === 0) {
    return (
      <View className="flex-1 bg-background justify-center px-4">
        <EmptyState
          glyph={Wallet}
          title="Create your first pocket"
          body="A pocket is a bank account, cash, an e-wallet, or a card. Everything else builds on it."
          actionLabel="Get started"
          onAction={() => router.push("/(app)/pocket-new?first=1")}
        />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }}
    >
      {/* Net worth hero — neutral tone: a balance is not a gain or a loss. */}
      <View className="px-4 mb-4">
        <SectionLabel>Net worth · {base}</SectionLabel>
        <Text className="text-ink text-amount-hero font-mono-bold mt-1">
          {base}&nbsp;{format(base, worth)}
        </Text>
      </View>

      {/* The one Primary on this screen (the center FAB is still an open gap). */}
      <View className="px-4 mb-6">
        <Button label="New entry" onPress={() => router.push("/(app)/entry-new")} />
      </View>

      {/* Accounts strip */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between px-4 mb-2">
          <SectionLabel>Accounts</SectionLabel>
          <Button
            label="See all"
            variant="tertiary"
            fullWidth={false}
            onPress={() => router.push("/(app)/pockets")}
          />
        </View>
        {active.length === 0 ? (
          <View className="px-4">
            <EmptyState
              glyph={Wallet}
              title="No active pockets"
              body="Every pocket you have is archived."
              actionLabel="Add a pocket"
              onAction={() => router.push("/(app)/pocket-new")}
            />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {active.map((a) => {
              const bal = accountSigned(a, lines);
              return (
                <Card key={a.id} padded={false} className="w-36 p-3">
                  <Text
                    className="text-caption font-sans-medium text-faint"
                    numberOfLines={1}
                  >
                    {a.name}
                  </Text>
                  <View className="mt-1">
                    <Amount
                      minor={bal}
                      currency={a.currency}
                      tone="neutral"
                      size="sm"
                      align="left"
                    />
                  </View>
                </Card>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Budget summary */}
      {budgetRows.length > 0 && (
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <SectionLabel>Budget · {now.toLocaleString("default", { month: "long" })}</SectionLabel>
            <Button
              label="Details"
              variant="tertiary"
              fullWidth={false}
              onPress={() => router.push("/(app)/budgets")}
            />
          </View>
          <Card>
            <View className="flex-row items-end justify-between mb-3">
              <View>
                <SectionLabel>Spent</SectionLabel>
                <Text className="text-ink text-amount-lg font-mono-bold mt-1">
                  {budgetBase}&nbsp;{format(budgetBase, totalSpent)}
                </Text>
              </View>
              <View className="items-end">
                <SectionLabel>Budget</SectionLabel>
                <Text className="text-faint text-amount font-mono-bold mt-1">
                  {budgetBase}&nbsp;{format(budgetBase, totalTarget)}
                </Text>
              </View>
            </View>
            <ProgressBar pct={budgetPct} />
            <Text
              className={`text-amount-sm font-mono-bold mt-2 ${
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
          <EmptyState
            glyph={Receipt}
            title="No entries yet"
            body="Log your first expense — it takes about ten seconds."
            actionLabel="Add an entry"
            onAction={() => router.push("/(app)/entry-new")}
          />
        ) : (
          <Card padded={false}>
            {recent.map((e, i) => {
              const debit = lines.find((l) => l.entryId === e.id && l.dc === "debit");
              const credit = lines.find((l) => l.entryId === e.id && l.dc === "credit");
              const category = accountFor(debit?.accountId ?? "");
              const source = accountFor(credit?.accountId ?? "");
              return (
                <ListRow
                  key={e.id}
                  divider={i > 0}
                  glyph={accountGlyph(category?.name ?? e.memo ?? "", category?.type)}
                  slot={category ? categorySlot(category.id) : undefined}
                  title={e.memo || category?.name || "Entry"}
                  subtitle={`${source?.name ?? "—"} · ${new Date(e.txnDate).toLocaleDateString()}`}
                  amount={debit ? -debit.amountMinor : undefined}
                  currency={e.currency}
                />
              );
            })}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
