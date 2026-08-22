import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Check } from "lucide-react-native";

import { useAuth } from "../../../src/lib/auth";
import { database } from "../../../src/lib/db";
import { useLedgerState } from "../../../src/lib/ledgerStore";
import { buildEntryViews, monthKey, monthLabel } from "../../../src/lib/ledger";
import { syncDatabase } from "../../../src/lib/sync";
import { useObservable } from "../../../src/lib/useObserve";
import { useStrings, useWording } from "../../../src/lib/wording";
import { Account, Entry, JournalLine } from "../../../src/model/models";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconBox,
  Receipt,
  ScreenHeader,
  SectionLabel,
  accountGlyph,
  categorySlot,
  formatGrouped,
} from "../../../src/components/ui";

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baseCurrency: base } = useAuth();
  const { t, showSides } = useWording();
  const s = useStrings();
  const activeBook = useLedgerState().active;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const linesObs = useMemo(() => database.get<JournalLine>("journal_lines").query().observe(), []);
  const entriesObs = useMemo(
    () => database.get<Entry>("entries").query().observeWithColumns(["txn_date"]),
    [],
  );
  const accounts = useObservable(accountsObs, [] as Account[]);
  const lines = useObservable(linesObs, [] as JournalLine[]);
  const entries = useObservable(entriesObs, [] as Entry[]);

  const view = useMemo(
    () => buildEntryViews(entries, lines, accounts).find((v) => v.entry.id === id) ?? null,
    [entries, lines, accounts, id],
  );

  // The entry can vanish under this screen: deleted here, or removed on another
  // device and pulled in. `entries.length` guards the first render, when the
  // observable has not delivered yet and everything looks missing.
  //
  // Focus-scoped, because router.back() from a screen that is not on top pops
  // whatever is above it instead.
  const gone = !view && entries.length > 0;
  useFocusEffect(
    useCallback(() => {
      if (gone) router.back();
    }, [gone]),
  );

  async function remove() {
    setBusy(true);
    try {
      await database.write(async () => {
        // Both sides go, and as deletions rather than destroys, so the server
        // learns about them on the next push.
        const own = lines.filter((l) => l.entryId === id);
        for (const l of own) await l.markAsDeleted();
        const entry = entries.find((e) => e.id === id);
        if (entry) await entry.markAsDeleted();
      });
      try {
        await syncDatabase();
      } catch {
        // Offline is fine — the deletion is local and pushes on the next cycle.
      }
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!view) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <ScreenHeader
          title={s.entry.detail.title}
          backLabel={s.common.back}
          backAccessibilityLabel={s.common.back}
          onBack={() => router.back()}
        />
        <View className="px-4">
          <EmptyState
            glyph={Receipt}
            title={s.entry.detail.notFound.title}
            body={s.entry.detail.notFound.body}
          />
        </View>
      </SafeAreaView>
    );
  }

  const category = view.direction === "out" ? view.to : view.from;
  const when = new Date(view.entry.txnDate);
  const negative = view.direction === "out";
  const sign = view.direction === "move" ? "" : negative ? "−" : "+";

  /**
   * Params for the add screen, prefilled from this entry.
   *
   * `replace` is what separates Edit from Duplicate: a posted entry is
   * immutable server-side, so an edit is a delete plus a fresh post, and the
   * add screen does both in one write when it is given an `edit` id.
   */
  const prefill = (replace: boolean) => {
    const q = new URLSearchParams({
      mode: view.direction,
      amount: String(view.amountMinor),
      from: view.from?.id ?? "",
      to: view.to?.id ?? "",
      memo: view.entry.memo ?? "",
      date: String(view.entry.txnDate),
    });
    if (replace) q.set("edit", view.entry.id);
    return `/(app)/entry-new?${q.toString()}`;
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title={s.entry.detail.title}
        backLabel={monthLabel(monthKey(when), { year: false })}
        backAccessibilityLabel={s.common.backTo(monthLabel(monthKey(when), { year: false }))}
        onBack={() => router.back()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View className="items-center" style={{ gap: 10 }}>
            <IconBox
              glyph={accountGlyph(category?.name ?? "", category?.type)}
              slot={category ? categorySlot(category.id) : undefined}
              size={56}
            />
            <Text
              className={`text-amount-hero font-mono-bold ${
                view.direction === "move"
                  ? "text-ink"
                  : negative
                    ? "text-error-strong"
                    : "text-success-strong"
              }`}
            >
              {sign}
              {formatGrouped(view.currency || base, view.amountMinor)}
            </Text>
            <Text className="text-body-lg font-sans-semibold text-ink">
              {category?.name ?? view.entry.memo ?? s.entry.detail.fallbackName}
            </Text>
            <Text className="text-caption font-sans-medium text-faint">
              {s.entry.detail.when(
                when.toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
                activeBook?.name ?? s.common.personalSpace,
              )}
            </Text>
          </View>
        </Card>

        <Card padded={false}>
          <DetailRow label={t("outOf")} value={view.from?.name ?? s.common.missing} />
          <View className="h-px bg-outline-variant" />
          <DetailRow label={t("into")} value={view.to?.name ?? s.common.missing} />
          {!!view.entry.memo && (
            <>
              <View className="h-px bg-outline-variant" />
              <DetailRow label={s.entry.detail.note} value={view.entry.memo} dim />
            </>
          )}
        </Card>

        {/* The two sides are a mode, not a default — see src/lib/wording.ts. */}
        {showSides && (
          <Card>
            <View className="flex-row items-center justify-between">
              <SectionLabel>{s.entry.detail.twoSides}</SectionLabel>
              <Badge tone="success" glyph={Check}>
                {s.entry.detail.balanced}
              </Badge>
            </View>
            <View className="flex-row items-center justify-between mt-2.5">
              <Text className="text-body font-sans text-ink">
                {view.to?.name ?? s.common.missing}
              </Text>
              <Text className="text-amount font-mono-medium text-ink">
                Dr {formatGrouped(view.currency || base, view.amountMinor)}
              </Text>
            </View>
            <View className="h-px bg-outline-variant my-2.5" />
            <View className="flex-row items-center justify-between">
              <Text className="text-body font-sans text-ink">
                {view.from?.name ?? s.common.missing}
              </Text>
              <Text className="text-amount font-mono-medium text-ink">
                Cr {formatGrouped(view.currency || base, view.amountMinor)}
              </Text>
            </View>
            <Text className="text-caption font-sans-medium text-faint mt-2.5">
              {s.entry.detail.twoSidesWhy}
            </Text>
          </Card>
        )}

        {view.runningBalance != null && view.runningCurrency && (
          <View className="bg-surface-container rounded-lg px-3.5 py-3 flex-row items-center justify-between">
            <Text className="text-caption font-sans-medium text-dim">
              {s.entry.detail.balanceAfter}
            </Text>
            <Text className="text-amount-sm font-mono-medium text-ink">
              {formatGrouped(view.runningCurrency, view.runningBalance)}
            </Text>
          </View>
        )}

        <View className="flex-row mt-2" style={{ gap: 8 }}>
          <View className="flex-1">
            <Button
              label={s.entry.detail.edit}
              variant="secondary"
              // Replaces this screen rather than stacking on it: the entry it
              // describes stops existing the moment the edit saves.
              onPress={() => router.replace(prefill(true))}
            />
          </View>
          <View className="flex-1">
            <Button
              label={s.entry.detail.duplicate}
              variant="secondary"
              onPress={() => router.push(prefill(false))}
            />
          </View>
          <View className="flex-1">
            <Button
              label={s.common.delete}
              variant="destructive"
              onPress={() => setConfirming(true)}
            />
          </View>
        </View>
      </ScrollView>

      <Dialog
        visible={confirming}
        title={s.entry.detail.confirmDelete.title}
        body={s.entry.detail.confirmDelete.body}
        confirmLabel={s.common.delete}
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </SafeAreaView>
  );
}

function DetailRow({ label, value, dim = false }: { label: string; value: string; dim?: boolean }) {
  return (
    <View className="flex-row items-center px-4 py-3.5" style={{ gap: 12 }}>
      <Text className="text-overline font-sans-semibold text-faint uppercase w-[60px]">{label}</Text>
      <Text className={`flex-1 text-body font-sans ${dim ? "text-dim" : "text-ink"}`}>
        {value}
      </Text>
    </View>
  );
}
