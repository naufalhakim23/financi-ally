import { useMemo, useState } from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { DirChips, EntryDayList, type DirFilter } from "../../../src/components/entry-row";
import { useAuth } from "../../../src/lib/auth";
import { database } from "../../../src/lib/db";
import {
  buildEntryViews,
  groupByDay,
  monthCsv,
  monthLabel,
  signedAmount,
  viewsInMonth,
} from "../../../src/lib/ledger";
import { useObservable } from "../../../src/lib/useObserve";
import { useStrings, useWording } from "../../../src/lib/wording";
import { Account, Entry, JournalLine } from "../../../src/model/models";
import {
  Card,
  EmptyState,
  Receipt,
  ScreenHeader,
  SectionLabel,
  StackedBar,
  categorySlot,
  formatGrouped,
  slotColor,
} from "../../../src/components/ui";

export default function MonthDetail() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const key = month ?? "";
  const { baseCurrency: base } = useAuth();
  const { t } = useWording();
  const s = useStrings();
  const [filter, setFilter] = useState<DirFilter>("all");

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const linesObs = useMemo(() => database.get<JournalLine>("journal_lines").query().observe(), []);
  const entriesObs = useMemo(
    () => database.get<Entry>("entries").query().observeWithColumns(["txn_date"]),
    [],
  );
  const accounts = useObservable(accountsObs, [] as Account[]);
  const lines = useObservable(linesObs, [] as JournalLine[]);
  const entries = useObservable(entriesObs, [] as Entry[]);

  const all = useMemo(() => buildEntryViews(entries, lines, accounts), [entries, lines, accounts]);
  const inMonth = useMemo(() => viewsInMonth(all, key), [all, key]);

  const income = inMonth.reduce((s, v) => s + Math.max(0, signedAmount(v)), 0);
  const expense = inMonth.reduce((s, v) => s + Math.max(0, -signedAmount(v)), 0);
  const net = income - expense;

  // Where it went: spending per category, largest first, with everything past
  // the ramp folded into a single "Other" slice (DESIGN.md → Charts).
  const categories = useMemo(() => {
    const totals = new Map<string, { label: string; value: number; slot: number }>();
    for (const v of inMonth) {
      if (v.direction !== "out" || !v.to) continue;
      const cur = totals.get(v.to.id);
      if (cur) cur.value += v.amountMinor;
      else
        totals.set(v.to.id, {
          label: v.to.name,
          value: v.amountMinor,
          slot: categorySlot(v.to.id),
        });
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1].value - a[1].value);
    const top = sorted.slice(0, 3).map(([id, x]) => ({ id, ...x }));
    const rest = sorted.slice(3);
    if (rest.length > 0) {
      top.push({
        id: "other",
        label: s.month.otherCategories,
        value: rest.reduce((sum, [, x]) => sum + x.value, 0),
        slot: 7,
      });
    }
    return top;
  }, [inMonth, s]);

  const filtered = inMonth.filter((v) => filter === "all" || v.direction === filter);
  const days = useMemo(() => groupByDay(filtered, base), [filtered, base]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title={key ? monthLabel(key) : s.month.fallbackTitle}
        backLabel={t("history")}
        onBack={() => router.back()}
        actionLabel={inMonth.length > 0 ? s.month.export : undefined}
        onAction={
          inMonth.length > 0
            ? () =>
                // The OS share sheet is the export target: no file system
                // permission, no new dependency, and the user picks where it
                // lands (Files, mail, a spreadsheet app).
                Share.share({
                  title: s.month.csvName(monthLabel(key)),
                  message: monthCsv(inMonth),
                }).catch(() => {
                  // Dismissing the share sheet rejects on some platforms.
                })
            : undefined
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View className="flex-row items-stretch" style={{ gap: 12 }}>
            <Figure
              label={s.month.in}
              value={`+${formatGrouped(base, income)}`}
              tone="text-success-strong"
            />
            <View className="w-px bg-outline-variant" />
            <Figure
              label={s.month.out}
              value={`−${formatGrouped(base, expense)}`}
              tone="text-error-strong"
            />
            <View className="w-px bg-outline-variant" />
            <Figure
              label={s.month.net}
              value={`${net < 0 ? "−" : "+"}${formatGrouped(base, Math.abs(net))}`}
              tone="text-ink"
            />
          </View>
        </Card>

        {categories.length > 0 && (
          <Card>
            <SectionLabel>{s.month.whereItWent}</SectionLabel>
            <View className="mt-3">
              <StackedBar
                segments={categories.map((c) => ({
                  id: c.id,
                  value: c.value,
                  color: slotColor(c.slot),
                }))}
              />
            </View>
            <View className="flex-row flex-wrap mt-3" style={{ rowGap: 8 }}>
              {categories.map((c) => (
                <View key={c.id} className="w-1/2 flex-row items-center pr-3" style={{ gap: 6 }}>
                  <View
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: slotColor(c.slot) }}
                  />
                  <Text className="flex-1 text-caption font-sans-medium text-dim" numberOfLines={1}>
                    {c.label}
                  </Text>
                  <Text className="text-amount-sm font-mono-medium text-ink">
                    {formatGrouped(base, c.value)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <DirChips value={filter} onChange={setFilter} />

        {days.length === 0 ? (
          <EmptyState
            glyph={Receipt}
            title={s.month.empty.title}
            body={s.month.empty.body}
          />
        ) : (
          <EntryDayList days={days} base={base} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View className="flex-1">
      <Text className="text-overline font-sans-semibold text-faint uppercase">{label}</Text>
      <Text className={`text-amount-sm font-mono-medium mt-1 ${tone}`}>{value}</Text>
    </View>
  );
}
