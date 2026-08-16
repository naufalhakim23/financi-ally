import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { FilterX, ListFilter, Search, X } from "lucide-react-native";

import { useAuth } from "../../../src/lib/auth";
import { format } from "../../../src/lib/money";
import { netWorth } from "../../../src/lib/balances";
import { database } from "../../../src/lib/db";
import {
  type EntryView,
  buildEntryViews,
  groupByDay,
  monthKey,
  monthLabel,
  signedAmount,
} from "../../../src/lib/ledger";
import { useObservable } from "../../../src/lib/useObserve";
import { useSyncRefresh } from "../../../src/lib/useSyncRefresh";
import { EntryRow } from "../../../src/components/entry-row";
import { useWording } from "../../../src/lib/wording";
import { Account, Entry, JournalLine } from "../../../src/model/models";
import {
  Button,
  Card,
  Chip,
  DayHeader,
  EmptyState,
  GroupedBars,
  IconButton,
  LegendDot,
  ListRow,
  Receipt,
  SectionLabel,
  SegmentedControl,
  Sheet,
  TitleBar,
  formatGrouped,
  useTheme,
} from "../../../src/components/ui";

type Tab = "months" | "entries";

type DirFilter = "all" | "in" | "out" | "move";

const DIR_LABEL: Record<DirFilter, string> = {
  all: "All",
  in: "Money in",
  out: "Money out",
  move: "Moves",
};

type MonthRow = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  /** Net worth at the end of that month. */
  closing: number;
};

/** Roll entry views up per calendar month, newest month first. */
function monthRows(views: EntryView[], worth: number): MonthRow[] {
  const byKey = new Map<string, MonthRow>();
  for (const v of views) {
    const key = monthKey(new Date(v.entry.txnDate));
    let row = byKey.get(key);
    if (!row) {
      row = { key, label: monthLabel(key), income: 0, expense: 0, net: 0, count: 0, closing: 0 };
      byKey.set(key, row);
    }
    const signed = signedAmount(v);
    if (signed > 0) row.income += signed;
    if (signed < 0) row.expense += -signed;
    row.net += signed;
    row.count += 1;
  }

  // Closing balance walks backwards from today's net worth: the balance at the
  // end of a month is today's less every month's net since.
  const rows = [...byKey.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
  let running = worth;
  for (const row of rows) {
    row.closing = running;
    running -= row.net;
  }
  return rows;
}

export default function HistoryScreen() {
  const { baseCurrency: base } = useAuth();
  const { t } = useWording();
  const { C } = useTheme();
  const pull = useSyncRefresh();
  const [tab, setTab] = useState<Tab>("months");
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [dir, setDir] = useState<DirFilter>("all");
  const [pocketId, setPocketId] = useState<string | null>(null);

  // Home's magnifier lands here with the search box already open. The param
  // carries a nonce so a second press re-opens it after the user dismissed it.
  const { search } = useLocalSearchParams<{ search?: string }>();
  useEffect(() => {
    if (search) setSearching(true);
  }, [search]);

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const linesObs = useMemo(() => database.get<JournalLine>("journal_lines").query().observe(), []);
  const entriesObs = useMemo(
    () => database.get<Entry>("entries").query().observeWithColumns(["txn_date"]),
    [],
  );
  const accounts = useObservable(accountsObs, [] as Account[]);
  const lines = useObservable(linesObs, [] as JournalLine[]);
  const entries = useObservable(entriesObs, [] as Entry[]);

  const views = useMemo(
    () => buildEntryViews(entries, lines, accounts),
    [entries, lines, accounts],
  );
  const worth = netWorth(accounts, lines);
  const months = useMemo(() => monthRows(views, worth), [views, worth]);

  // Five most recent months, oldest first — bars read left to right in time.
  const barPoints = months
    .slice(0, 5)
    .reverse()
    .map((m) => ({
      key: m.key,
      label: new Date(`${m.key}-01`).toLocaleDateString(undefined, { month: "short" }),
      a: m.income,
      b: m.expense,
    }));

  const thisYear = new Date().getFullYear();
  const currentYearMonths = months.filter((m) => Number(m.key.slice(0, 4)) === thisYear);
  const priorYears = [...new Set(months.map((m) => m.key.slice(0, 4)))]
    .filter((y) => Number(y) !== thisYear)
    .map((y) => {
      const rows = months.filter((m) => m.key.startsWith(y));
      return {
        year: y,
        count: rows.length,
        net: rows.reduce((s, r) => s + r.net, 0),
        // Rows are newest-first, so the head is the last month that had entries.
        latest: rows[0].key,
      };
    });

  // Only money accounts are worth filtering by: an expense category shows up on
  // one side of an entry anyway, and the pocket is what people remember.
  const pockets = useMemo(
    () => accounts.filter((a) => (a.type === "asset" || a.type === "liability") && !a.archived),
    [accounts],
  );
  const filtered = useMemo(
    () =>
      views.filter(
        (v) =>
          (dir === "all" || v.direction === dir) &&
          (pocketId === null || v.from?.id === pocketId || v.to?.id === pocketId),
      ),
    [views, dir, pocketId],
  );

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return filtered;
    return filtered.filter((v) =>
      [v.entry.memo, v.from?.name, v.to?.name, format(v.currency, v.amountMinor)]
        .some((s) => s?.toLowerCase().includes(needle)),
    );
  }, [filtered, q]);

  const days = useMemo(() => groupByDay(matches, base), [matches, base]);

  const filtersOn = dir !== "all" || pocketId !== null;
  const pocketName = pockets.find((p) => p.id === pocketId)?.name;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <TitleBar title={t("history")}>
        <IconButton
          glyph={searching ? X : Search}
          label={searching ? "Close search" : "Search entries"}
          onPress={() => {
            setSearching((s) => !s);
            setQ("");
          }}
        />
        <IconButton
          glyph={filtersOn ? FilterX : ListFilter}
          label={filtersOn ? "Filters on" : "Filter"}
          onPress={() => setFilterOpen(true)}
        />
      </TitleBar>

      {searching ? (
        <View className="px-4 pb-3">
          <View className="flex-row items-center bg-surface-container rounded-lg px-3 min-h-touch">
            <Search size={18} color={C.faint} strokeWidth={1.75} />
            <TextInput
              value={q}
              onChangeText={setQ}
              autoFocus
              placeholder="Memo, pocket or amount"
              placeholderTextColor={C.disabled}
              accessibilityLabel="Search entries"
              className="flex-1 text-body font-sans text-ink ml-2 py-3"
            />
          </View>
        </View>
      ) : (
        <View className="px-4 pb-3">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: "months", label: "Months" },
              { value: "entries", label: "All entries" },
            ]}
          />
        </View>
      )}

      {filtersOn && (
        <View className="flex-row items-center px-4 pb-3" style={{ gap: 8 }}>
          {dir !== "all" && <Chip label={DIR_LABEL[dir]} active onPress={() => setDir("all")} />}
          {pocketName && <Chip label={pocketName} active onPress={() => setPocketId(null)} />}
          <Chip
            label="Clear"
            onPress={() => {
              setDir("all");
              setPocketId(null);
            }}
          />
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={pull ? <RefreshControl {...pull} tintColor={C.dim} /> : undefined}
      >
        {views.length === 0 && (
          <EmptyState
            glyph={Receipt}
            title="No entries yet"
            body="Every money move you log shows up here, newest first."
          />
        )}

        {views.length > 0 && matches.length === 0 && (searching || filtersOn) && (
          <EmptyState
            glyph={Receipt}
            title="No matches"
            body="Nothing here fits the search and filters."
          />
        )}

        {!searching && !filtersOn && tab === "months" ? (
          <>
            {barPoints.length > 0 && (
              <Card>
                <View className="flex-row items-center justify-between mb-3">
                  <SectionLabel>in vs out · {thisYear}</SectionLabel>
                  <View className="flex-row" style={{ gap: 12 }}>
                    <LegendDot color={C.success} label="in" />
                    <LegendDot color={C.primary} label="out" />
                  </View>
                </View>
                <GroupedBars points={barPoints} />
              </Card>
            )}

            {currentYearMonths.length > 0 && (
              <Card padded={false}>
                {currentYearMonths.map((m, i) => (
                  <ListRow
                    key={m.key}
                    divider={i > 0}
                    title={m.label}
                    titleSize="lg"
                    subtitle={`in ${formatGrouped(base, m.income)} · out ${formatGrouped(
                      base,
                      m.expense,
                    )} · ${m.count} ${m.count === 1 ? "entry" : "entries"}`}
                    amount={m.net}
                    currency={base}
                    meta={`end ${formatGrouped(base, m.closing)}`}
                    chevron
                    onPress={() => router.push(`/(app)/month/${m.key}`)}
                  />
                ))}
              </Card>
            )}

            {priorYears.map((y) => (
              <Card key={y.year} padded={false}>
                <ListRow
                  title={y.year}
                  subtitle={`${y.count} ${y.count === 1 ? "month" : "months"}`}
                  amount={y.net}
                  currency={base}
                  chevron
                  onPress={() => router.push(`/(app)/month/${y.latest}`)}
                />
              </Card>
            ))}
          </>
        ) : (
          days.map((day) => (
            <View key={day.key} style={{ gap: 8 }}>
              <DayHeader
                label={day.label}
                total={`${day.net < 0 ? "−" : "+"}${formatGrouped(base, day.net)}`}
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

      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter entries">
        <SectionLabel>direction</SectionLabel>
        <View className="flex-row flex-wrap py-2" style={{ gap: 8 }}>
          {(Object.keys(DIR_LABEL) as DirFilter[]).map((d) => (
            <Chip key={d} label={DIR_LABEL[d]} active={dir === d} onPress={() => setDir(d)} />
          ))}
        </View>

        {pockets.length > 0 && (
          <>
            <SectionLabel>pocket</SectionLabel>
            <View className="flex-row flex-wrap py-2" style={{ gap: 8 }}>
              <Chip label="Any" active={pocketId === null} onPress={() => setPocketId(null)} />
              {pockets.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  active={pocketId === p.id}
                  onPress={() => setPocketId(pocketId === p.id ? null : p.id)}
                />
              ))}
            </View>
          </>
        )}

        <View className="pt-3">
          <Button label={`Show ${matches.length} ${matches.length === 1 ? "entry" : "entries"}`} onPress={() => setFilterOpen(false)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
