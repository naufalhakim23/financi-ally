import { useMemo, useState } from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { EntryRow } from "../../../src/components/entry-row";
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
import { useWording } from "../../../src/lib/wording";
import { Account, Entry, JournalLine } from "../../../src/model/models";
import {
  Card,
  Chip,
  DayHeader,
  EmptyState,
  Receipt,
  ScreenHeader,
  SectionLabel,
  StackedBar,
  categorySlot,
  formatGrouped,
  slotColor,
} from "../../../src/components/ui";

type Filter = "all" | "out" | "in" | "moves";

export default function MonthDetail() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const key = month ?? "";
  const { baseCurrency: base } = useAuth();
  const { t } = useWording();
  const [filter, setFilter] = useState<Filter>("all");

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
        label: "Other",
        value: rest.reduce((s, [, x]) => s + x.value, 0),
        slot: 7,
      });
    }
    return top;
  }, [inMonth]);

  const filtered = inMonth.filter((v) =>
    filter === "all"
      ? true
      : filter === "moves"
        ? v.direction === "move"
        : v.direction === filter,
  );
  const days = useMemo(() => groupByDay(filtered, base), [filtered, base]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title={key ? monthLabel(key) : "Month"}
        backLabel={t("history")}
        onBack={() => router.back()}
        actionLabel={inMonth.length > 0 ? "Export" : undefined}
        onAction={
          inMonth.length > 0
            ? () =>
                // The OS share sheet is the export target: no file system
                // permission, no new dependency, and the user picks where it
                // lands (Files, mail, a spreadsheet app).
                Share.share({
                  title: `${monthLabel(key)}.csv`,
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
            <Figure label="in" value={`+${formatGrouped(base, income)}`} tone="text-success-strong" />
            <View className="w-px bg-outline-variant" />
            <Figure
              label="out"
              value={`−${formatGrouped(base, expense)}`}
              tone="text-error-strong"
            />
            <View className="w-px bg-outline-variant" />
            <Figure
              label="net"
              value={`${net < 0 ? "−" : "+"}${formatGrouped(base, Math.abs(net))}`}
              tone="text-ink"
            />
          </View>
        </Card>

        {categories.length > 0 && (
          <Card>
            <SectionLabel>where it went</SectionLabel>
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

        <View className="flex-row" style={{ gap: 8 }}>
          {(
            [
              ["all", "All"],
              ["out", "Out"],
              ["in", "In"],
              ["moves", "Moves"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              active={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
        </View>

        {days.length === 0 ? (
          <EmptyState
            glyph={Receipt}
            title="Nothing here"
            body="No entries in this month match that filter."
          />
        ) : (
          days.map((day) => (
            <View key={day.key} style={{ gap: 8 }}>
              <DayHeader
                label={day.label}
                total={`${day.net < 0 ? "−" : "+"}${formatGrouped(base, Math.abs(day.net))}`}
              />
              <Card padded={false}>
                {day.rows.map((v, i) => (
                  <EntryRow key={v.entry.id} view={v} base={base} divider={i > 0} />
                ))}
              </Card>
            </View>
          ))
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
