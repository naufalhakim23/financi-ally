import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, Check } from "lucide-react-native";

import { useAuth } from "../../../src/lib/auth";
import { database } from "../../../src/lib/db";
import { buildEntryViews, monthKey, monthLabel } from "../../../src/lib/ledger";
import { syncDatabase } from "../../../src/lib/sync";
import { useObservable } from "../../../src/lib/useObserve";
import { useWording } from "../../../src/lib/wording";
import { Account, Entry, JournalLine } from "../../../src/model/models";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconBox,
  ListRow,
  Receipt,
  ScreenHeader,
  SectionLabel,
  Sheet,
  accountGlyph,
  categorySlot,
  formatGrouped,
  ICON,
  useTheme,
} from "../../../src/components/ui";

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baseCurrency: base } = useAuth();
  const { t, showSides } = useWording();
  const { C } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState(false);
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
      router.back();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  /**
   * Re-file the entry under a different category, leaving both amounts and the
   * money side untouched. Only the category line moves, so the entry stays
   * balanced by construction — no re-post, no server round trip beyond sync.
   */
  async function moveTo(accountId: string) {
    if (!view) return;
    const side = view.direction === "in" ? "credit" : "debit";
    const line = lines.find((l) => l.entryId === id && l.dc === side);
    if (!line) return;
    setBusy(true);
    try {
      await database.write(async () => {
        await line.update((l: JournalLine) => {
          l.accountId = accountId;
        });
      });
      try {
        await syncDatabase();
      } catch {
        // Offline is fine — the change is local and pushes on the next cycle.
      }
    } finally {
      setBusy(false);
      setMoving(false);
    }
  }

  if (!view) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <ScreenHeader title="Entry" backLabel="Back" onBack={() => router.back()} />
        <View className="px-4">
          <EmptyState glyph={Receipt} title="Entry not found" body="It may have been deleted." />
        </View>
      </SafeAreaView>
    );
  }

  const category = view.direction === "out" ? view.to : view.from;
  // A move sits between two money accounts, so it has no category to re-file.
  const moveTargets =
    view.direction === "move" || !category
      ? []
      : accounts.filter((a) => a.type === category.type && !a.archived && a.id !== category.id);
  const when = new Date(view.entry.txnDate);
  const negative = view.direction === "out";
  const sign = view.direction === "move" ? "" : negative ? "−" : "+";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title="Entry"
        backLabel={monthLabel(monthKey(when)).split(" ")[0]}
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
              {category?.name ?? view.entry.memo ?? "Entry"}
            </Text>
            <Text className="text-caption font-sans-medium text-faint">
              {when.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} ·{" "}
              {when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · Personal
            </Text>
          </View>
        </Card>

        <Card padded={false}>
          <DetailRow label={t("outOf")} value={view.from?.name ?? "—"} />
          <View className="h-px bg-outline-variant" />
          <DetailRow label={t("into")} value={view.to?.name ?? "—"} />
          {!!view.entry.memo && (
            <>
              <View className="h-px bg-outline-variant" />
              <DetailRow label="note" value={view.entry.memo} dim />
            </>
          )}
        </Card>

        {/* The two sides are a mode, not a default — see src/lib/wording.ts. */}
        {showSides && (
          <Card>
            <View className="flex-row items-center justify-between">
              <SectionLabel>the two sides</SectionLabel>
              <Badge tone="success" glyph={Check}>
                balanced
              </Badge>
            </View>
            <View className="flex-row items-center justify-between mt-2.5">
              <Text className="text-body font-sans-medium text-ink">{view.to?.name ?? "—"}</Text>
              <Text className="text-amount font-mono-medium text-ink">
                Dr {formatGrouped(view.currency || base, view.amountMinor)}
              </Text>
            </View>
            <View className="h-px bg-outline-variant my-2.5" />
            <View className="flex-row items-center justify-between">
              <Text className="text-body font-sans-medium text-ink">{view.from?.name ?? "—"}</Text>
              <Text className="text-amount font-mono-medium text-ink">
                Cr {formatGrouped(view.currency || base, view.amountMinor)}
              </Text>
            </View>
            <Text className="text-caption font-sans-medium text-faint mt-2.5">
              shown because wording is set to finance
            </Text>
          </Card>
        )}

        {view.runningBalance != null && view.runningCurrency && (
          <View className="bg-surface-container rounded-lg px-3.5 py-3 flex-row items-center justify-between">
            <Text className="text-caption font-sans-medium text-dim">balance after this entry</Text>
            <Text className="text-amount-sm font-mono-medium text-ink">
              {formatGrouped(view.runningCurrency, view.runningBalance)}
            </Text>
          </View>
        )}

        {/* Receipts have no upload path yet; the placeholder says what will
            appear rather than offering an action that does nothing. */}
        <View className="bg-surface border border-dashed border-outline-strong rounded-2xl p-3.5 items-center">
          <Camera size={ICON.xxl} color={C.disabled} strokeWidth={1.75} />
          <Text className="text-caption font-sans-medium text-faint mt-1.5">
            A receipt photo you add will appear here
          </Text>
        </View>

        <View className="flex-row mt-2" style={{ gap: 8 }}>
          <View className="flex-1">
            <Button
              label="Duplicate"
              variant="secondary"
              onPress={() =>
                router.push(
                  `/(app)/entry-new?amount=${view.amountMinor}&from=${view.from?.id ?? ""}&to=${
                    view.to?.id ?? ""
                  }`,
                )
              }
            />
          </View>
          {moveTargets.length > 0 && (
            <View className="flex-1">
              <Button label="Move" variant="secondary" onPress={() => setMoving(true)} />
            </View>
          )}
          <View className="flex-1">
            <Button label="Delete" variant="destructive" onPress={() => setConfirming(true)} />
          </View>
        </View>
      </ScrollView>

      <Sheet visible={moving} onClose={() => setMoving(false)} title={`Move to another ${category?.type ?? "category"}`}>
        {moveTargets.map((a, i) => (
          <ListRow
            key={a.id}
            divider={i > 0}
            glyph={accountGlyph(a.name, a.type)}
            slot={categorySlot(a.id)}
            title={a.name}
            subtitle={a.currency}
            onPress={() => moveTo(a.id)}
          />
        ))}
      </Sheet>

      <Dialog
        visible={confirming}
        title="Delete this entry?"
        body="Both sides of the entry are removed. This cannot be undone."
        confirmLabel="Delete"
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
      <Text className={`flex-1 text-body font-sans-medium ${dim ? "text-dim" : "text-ink"}`}>
        {value}
      </Text>
    </View>
  );
}
