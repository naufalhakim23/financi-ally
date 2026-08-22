import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus } from "lucide-react-native";

import { authedApi } from "../../../src/lib/api";
import { useAuth } from "../../../src/lib/auth";
import { accountSigned } from "../../../src/lib/balances";
import {
  type Bucket,
  type BucketId,
  buildBuckets,
  spendingForMonth,
} from "../../../src/lib/buckets";
import { database } from "../../../src/lib/db";
import { EMPTY_RATES, type RateTable } from "../../../src/lib/fx";
import { useObservable } from "../../../src/lib/useObserve";
import { useSyncRefresh } from "../../../src/lib/useSyncRefresh";
import { useStrings, useWording } from "../../../src/lib/wording";
import { Account, Budget, Entry, JournalLine } from "../../../src/model/models";
import {
  BucketChildRow,
  Button,
  Card,
  Chip,
  EmptyState,
  ListRow,
  ProgressBar,
  TitleBar,
  Wallet,
  accountGlyph,
  categorySlot,
  formatGrouped,
  slotColor,
  useTheme,
} from "../../../src/components/ui";

// Direction 2a: accounts and categories in one tree. Every bucket carries one
// figure; expanding it reveals the accounts behind that figure with their own
// add / move affordances.
export default function BucketsScreen() {
  const { guest, baseCurrency: base } = useAuth();
  const { t } = useWording();
  const s = useStrings();
  const { C } = useTheme();
  const pull = useSyncRefresh();
  const [open, setOpen] = useState<BucketId | null>("cash");

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

  const ratesQuery = useQuery({
    queryKey: ["fx-rates"],
    queryFn: () => authedApi.listFxRates(),
    staleTime: 30 * 60 * 1000,
    enabled: !guest, // no token in guest mode; conversions fall back to EMPTY_RATES
  });
  const rates: RateTable = ratesQuery.data
    ? { rates: ratesQuery.data.rates ?? [], asOf: ratesQuery.data.as_of ?? null }
    : EMPTY_RATES;

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

  const spent = spendingRows.reduce((s, r) => s + r.spent, 0);
  const planned = spendingRows.reduce((s, r) => s + (r.target ?? 0), 0);
  const spendPct = planned > 0 ? (spent / planned) * 100 : 0;

  const toggle = (id: BucketId) => setOpen((cur) => (cur === id ? null : id));

  function header(b: Bucket, expandable: boolean) {
    const negative = b.id === "owed";
    return (
      <ListRow
        glyph={accountGlyph(b.title, negative ? "liability" : "asset")}
        title={b.title}
        titleSize="lg"
        subtitle={b.subtitle}
        subtitleTone={b.converted ? "warning" : "faint"}
        amount={b.total ?? 0}
        currency={base}
        amountSize="lg"
        amountTone="neutral"
        meta={b.total == null ? s.buckets.rateUnavailable : undefined}
        chevron={expandable}
        chevronGlyph={open === b.id ? ChevronUp : ChevronDown}
        onPress={expandable ? () => toggle(b.id) : undefined}
      />
    );
  }

  const byId = (id: BucketId) => buckets.find((b) => b.id === id)!;
  const moneyBuckets: BucketId[] = ["cash", "foreign"];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <TitleBar title={t("buckets")}>
        <Button
          label={s.buckets.newPocket}
          glyph={Plus}
          fullWidth={false}
          onPress={() => router.push("/(app)/pocket-new")}
        />
      </TitleBar>

      {/* Spaces are the sharing boundary in direction 2a but have no backend
          concept yet, so only the one space a user has is offered. */}
      <View className="flex-row px-4 pb-3" style={{ gap: 8 }}>
        <Chip label={s.buckets.space} active onPress={() => {}} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={pull ? <RefreshControl {...pull} tintColor={C.dim} /> : undefined}
      >
        {accounts.length === 0 && (
          <EmptyState
            glyph={Wallet}
            title={s.buckets.empty.title}
            body={s.buckets.empty.body}
            actionLabel={s.buckets.empty.action}
            onAction={() => router.push("/(app)/setup")}
          />
        )}

        {moneyBuckets.map((id) => {
          const b = byId(id);
          if (b.children.length === 0) return null;
          const expanded = open === id;
          return (
            <Card key={id} padded={false}>
              {header(b, true)}
              {expanded &&
                b.children.map((c) => (
                  <BucketChildRow
                    key={c.account.id}
                    name={c.account.name}
                    meta={`${c.account.currency} ${formatGrouped(c.account.currency, c.balance)}`}
                    onAdd={() => router.push(`/(app)/entry-new?from=${c.account.id}`)}
                    onMove={() => router.push(`/(app)/entry-new?mode=move&from=${c.account.id}`)}
                  />
                ))}
            </Card>
          );
        })}

        {/* Spending is a period, not a balance — it gets the plan bar and the
            category breakdown rather than a child list. */}
        {spendingRows.length > 0 && (
          <Card padded={false}>
            {/* Spending is a bucket like the others, so it opens the same way —
                the whole row, not a separate button below the breakdown. */}
            <ListRow
              glyph={accountGlyph("Spending", "expense")}
              title={s.buckets.spending}
              titleSize="lg"
              subtitle={
                planned > 0
                  ? s.buckets.spendingPlanned(
                      formatGrouped(base, spent),
                      formatGrouped(base, planned),
                    )
                  : s.buckets.spendingThisMonth(formatGrouped(base, spent))
              }
              chevron
              onPress={() => router.push("/(app)/budgets")}
            />
            <View className="px-4 pb-4">
              {planned > 0 && <ProgressBar pct={spendPct} />}

              <View className="mt-3" style={{ gap: 8 }}>
                {spendingRows.slice(0, 5).map((r) => {
                  const over = r.target != null && r.spent > r.target;
                  return (
                    <View key={r.account.id} className="flex-row items-center" style={{ gap: 8 }}>
                      <View
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: slotColor(categorySlot(r.account.id)) }}
                      />
                      <Text
                        className="flex-1 text-caption font-sans-medium text-dim"
                        numberOfLines={1}
                      >
                        {r.account.name}
                      </Text>
                      <Text
                        className={`text-amount-sm font-mono-medium ${
                          over ? "text-warning-strong" : "text-ink"
                        }`}
                      >
                        {formatGrouped(base, r.spent)}
                        {r.target != null ? ` / ${formatGrouped(base, r.target)}` : ""}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Card>
        )}

        {byId("owed").children.length > 0 && <Card padded={false}>{header(byId("owed"), false)}</Card>}
      </ScrollView>
    </SafeAreaView>
  );
}
