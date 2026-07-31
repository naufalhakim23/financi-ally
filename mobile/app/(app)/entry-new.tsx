import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Calendar, ChevronRight, Plus } from "lucide-react-native";

import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { syncDatabase } from "../../src/lib/sync";
import { useObservable } from "../../src/lib/useObserve";
import { useWording } from "../../src/lib/wording";
import { Account } from "../../src/model/models";
import {
  AmountWell,
  Button,
  EmptyState,
  IconBox,
  Keypad,
  type KeypadKey,
  SegmentedControl,
  Sheet,
  ListRow,
  Wallet,
  accountGlyph,
  applyKey,
  categorySlot,
  formatGrouped,
} from "../../src/components/ui";

type Mode = "out" | "in" | "move";

// Which account types each side of the entry may point at. An entry is always
// a balanced pair, so the mode fully determines both sides' candidates.
const SIDES: Record<Mode, { from: string[]; to: string[] }> = {
  out: { from: ["asset", "liability"], to: ["expense"] },
  in: { from: ["income"], to: ["asset"] },
  move: { from: ["asset", "liability"], to: ["asset", "liability"] },
};

export default function EntryNew() {
  const params = useLocalSearchParams<{ mode?: string; from?: string; to?: string; amount?: string }>();
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";
  const { t, showSides } = useWording();

  const [mode, setMode] = useState<Mode>(
    params.mode === "in" || params.mode === "move" ? params.mode : "out",
  );
  // Digits are minor units, the way a bank keypad works: in a two-decimal
  // currency "45" is 0.45. That keeps the string always parseable — there is no
  // half-typed decimal point for toMinor to reject.
  const [digits, setDigits] = useState(params.amount ?? "");
  const [fromId, setFromId] = useState<string | null>(params.from ?? null);
  const [toId, setToId] = useState<string | null>(params.to ?? null);
  const [memo, setMemo] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const accounts = useObservable(accountsObs, [] as Account[]);
  const active = accounts.filter((a) => !a.archived);

  const fromOptions = active.filter((a) => SIDES[mode].from.includes(a.type));
  const toOptions = active.filter((a) => SIDES[mode].to.includes(a.type));

  // Switching mode changes what each side may be; a stale pick would silently
  // post to the wrong account, so it is dropped rather than carried over.
  useEffect(() => {
    setFromId((cur) => (cur && fromOptions.some((a) => a.id === cur) ? cur : null));
    setToId((cur) => (cur && toOptions.some((a) => a.id === cur) ? cur : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, accounts.length]);

  const from = active.find((a) => a.id === fromId) ?? null;
  const to = active.find((a) => a.id === toId) ?? null;
  const currency = from?.currency ?? base;

  async function save() {
    setErr(null);
    if (!fromId || !toId) {
      setErr(`Pick where the money comes ${mode === "in" ? "from" : "out of"} and where it goes`);
      return;
    }
    if (fromId === toId) {
      setErr("Pick two different accounts");
      return;
    }
    const minor = Number(digits || "0");
    if (!Number.isSafeInteger(minor)) {
      setErr("Enter a valid amount");
      return;
    }
    if (minor <= 0) {
      setErr("Amount must be greater than zero");
      return;
    }

    setBusy(true);
    try {
      // Balanced single-currency entry: debit the destination, credit the
      // source. Written locally first so it works offline; sync pushes it and
      // the server re-runs the balance invariant.
      await database.write(async () => {
        const entry = await database.get("entries").create((e: any) => {
          e.txnDate = Date.now();
          e.status = "posted";
          e.currency = currency;
          e.source = "manual";
          e.memo = memo;
        });
        await database.get("journal_lines").create((l: any) => {
          l.entryId = entry.id;
          l.accountId = toId;
          l.dc = "debit";
          l.amountMinor = minor;
          l.currency = currency;
        });
        await database.get("journal_lines").create((l: any) => {
          l.entryId = entry.id;
          l.accountId = fromId;
          l.dc = "credit";
          l.amountMinor = minor;
          l.currency = currency;
        });
      });
      try {
        await syncDatabase();
      } catch (e) {
        console.warn("[entry] sync deferred", e);
      }
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  const pickOptions = picking === "from" ? fromOptions : toOptions;
  const empty = fromOptions.length === 0 || toOptions.length === 0;

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} accessibilityRole="button" className="min-h-touch justify-center">
          <Text className="text-body-strong font-sans-semibold text-dim">Cancel</Text>
        </Pressable>
        <Text className="text-headline font-sans-semibold text-ink">{t("addEntry")}</Text>
        <Pressable
          onPress={save}
          disabled={busy}
          accessibilityRole="button"
          className="min-h-touch justify-center"
        >
          <Text className="text-body-strong font-sans-semibold text-info">Save</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {empty && (
          <EmptyState
            glyph={Wallet}
            title="Set up a pocket first"
            body="An entry moves money between two places — you need both before you can log one."
            actionLabel="Create a pocket"
            onAction={() => router.push("/(app)/pocket-new?first=1")}
          />
        )}

        <SegmentedControl
          value={mode}
          onChange={(m) => setMode(m as Mode)}
          options={[
            { value: "out", label: "Out" },
            { value: "in", label: "In" },
            { value: "move", label: "Move" },
          ]}
        />

        <AmountWell
          currency={currency}
          display={digits ? formatGrouped(currency, Number(digits)) : ""}
          helper={err ?? undefined}
        />

        <View className="border border-outline rounded-lg overflow-hidden">
          <PickerRow
            label={mode === "in" ? "from" : t("outOf").toLowerCase()}
            account={from}
            placeholder="Choose"
            onPress={() => setPicking("from")}
          />
          <View className="h-px bg-outline-variant" />
          <PickerRow
            label={t("into").toLowerCase()}
            account={to}
            placeholder="Choose"
            onPress={() => setPicking("to")}
          />
        </View>

        {showSides && from && to && (
          <View className="flex-row items-center justify-between bg-surface-container rounded-lg px-3.5 py-2.5">
            <Text className="text-mono-meta font-mono text-dim">
              Dr {to.name} {formatGrouped(currency, Number(digits || 0))}
            </Text>
            <Text className="text-mono-meta font-mono text-dim">
              Cr {from.name} {formatGrouped(currency, Number(digits || 0))}
            </Text>
          </View>
        )}

        <View className="flex-row" style={{ gap: 8 }}>
          <MetaChip glyph={Calendar} label="Today" active />
          <MetaChip glyph={Plus} label={memo ? "Note added" : "Note"} active={!!memo} onPress={() => setNoteOpen(true)} />
        </View>

        <Keypad onKey={(k: KeypadKey) => setDigits((d) => applyKey(d, k))} />

        <Button label="Save transaction" onPress={save} busy={busy} disabled={empty} />
      </ScrollView>

      <Sheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === "from" ? "Where from" : "Where to"}
      >
        {pickOptions.map((a, i) => (
          <ListRow
            key={a.id}
            divider={i > 0}
            glyph={accountGlyph(a.name, a.type)}
            slot={categorySlot(a.id)}
            title={a.name}
            subtitle={a.currency}
            onPress={() => {
              if (picking === "from") setFromId(a.id);
              else setToId(a.id);
              setPicking(null);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={noteOpen} onClose={() => setNoteOpen(false)} title="Note">
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="What was this for?"
          placeholderTextColor="#98A1B5"
          autoFocus
          className="bg-surface-container rounded-lg px-4 py-3 min-h-touch text-body font-sans-medium text-ink"
        />
        <View className="mt-4">
          <Button label="Done" onPress={() => setNoteOpen(false)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function PickerRow({
  label,
  account,
  placeholder,
  onPress,
}: {
  label: string;
  account: Account | null;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${account?.name ?? placeholder}`}
      className="flex-row items-center bg-surface px-3.5 py-3 min-h-touch"
      style={{ gap: 12 }}
    >
      <Text className="text-overline font-sans-semibold text-faint uppercase w-[52px]">{label}</Text>
      {account ? (
        <IconBox
          glyph={accountGlyph(account.name, account.type)}
          slot={categorySlot(account.id)}
          size={32}
        />
      ) : null}
      <View className="flex-1">
        <Text
          className={`text-body font-sans-medium ${account ? "text-ink" : "text-disabled"}`}
          numberOfLines={1}
        >
          {account?.name ?? placeholder}
        </Text>
        {account && (
          <Text className="text-caption font-sans-medium text-faint">{account.currency}</Text>
        )}
      </View>
      <ChevronRight size={18} color="#C0C7DA" strokeWidth={1.75} />
    </Pressable>
  );
}

function MetaChip({
  glyph: G,
  label,
  active = false,
  onPress,
}: {
  glyph: typeof Calendar;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      className="flex-row items-center bg-surface-container rounded-full px-3.5 py-2"
      style={{ gap: 6 }}
    >
      <G size={14} color={active ? "#1A1F2E" : "#5A6379"} strokeWidth={1.75} />
      <Text className={`text-label font-sans-semibold ${active ? "text-ink" : "text-dim"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
