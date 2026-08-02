import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Calendar, Camera, ChevronRight, Plus } from "lucide-react-native";

import { authedApi } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { accountSigned } from "../../src/lib/balances";
import { spendingForMonth } from "../../src/lib/buckets";
import { database } from "../../src/lib/db";
import { EMPTY_RATES, convert, type RateTable } from "../../src/lib/fx";
import { syncDatabase } from "../../src/lib/sync";
import { useObservable } from "../../src/lib/useObserve";
import { useWording } from "../../src/lib/wording";
import { Account, Budget, Entry, JournalLine } from "../../src/model/models";
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
  useTheme,
} from "../../src/components/ui";

type Mode = "out" | "in" | "move";

// Mirrors the server's floor (internal/scan: minConfidence).
const LOW_CONFIDENCE = 0.6;

// Which account types each side of the entry may point at. An entry is always
// a balanced pair, so the mode fully determines both sides' candidates.
const SIDES: Record<Mode, { from: string[]; to: string[] }> = {
  out: { from: ["asset", "liability"], to: ["expense"] },
  in: { from: ["income"], to: ["asset"] },
  move: { from: ["asset", "liability"], to: ["asset", "liability"] },
};

export default function EntryNew() {
  const params = useLocalSearchParams<{ mode?: string; from?: string; to?: string; amount?: string }>();
  const { guest, baseCurrency: base } = useAuth();
  const { t, showSides } = useWording();
  const { C } = useTheme();

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
  // Receipt scanning. txnDate is state rather than "now" because a receipt is
  // often photographed days later, and posting it under today's date puts the
  // spend in the wrong month and against the wrong budget.
  const [txnDate, setTxnDate] = useState<Date>(new Date());
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  // The currency the model read off the receipt. Kept because amount_minor is in
  // *that* currency's minor units while the entry posts in the source account's
  // — same number, different money — and save() has to refuse the mismatch.
  const [scanCurrency, setScanCurrency] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // Advisory, not blocking. Separate from err so a hint and a refusal never
  // wear the same colour.
  const [warn, setWarn] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);

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
  const active = accounts.filter((a) => !a.archived);

  // Rates are display-only here — the entry posts in the source account's own
  // currency either way, so a failed fetch just drops the conversion line.
  const ratesQuery = useQuery({
    queryKey: ["fx-rates"],
    queryFn: () => authedApi.listFxRates(),
    staleTime: 30 * 60 * 1000,
    enabled: !guest, // no token in guest mode; the conversion line just drops
  });
  const rates: RateTable = ratesQuery.data
    ? { rates: ratesQuery.data.rates ?? [], asOf: ratesQuery.data.as_of ?? null }
    : EMPTY_RATES;

  // This month's spend per category, so a destination row can say how much of
  // its plan is already gone before the user commits to another entry.
  const spending = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const idsInMonth = new Set(
      entries
        .filter((e) => {
          const d = new Date(e.txnDate);
          return d >= start && d < end;
        })
        .map((e) => e.id),
    );
    return spendingForMonth(accounts, lines, idsInMonth, budgets, base, start);
  }, [accounts, lines, entries, budgets, base]);

  /**
   * What a picker row says beneath the account name. A pocket states what is
   * left in it; a category states how much of this month's plan it has used —
   * both are the figure that decides whether this entry is a good idea.
   */
  function subtitleFor(a: Account): string {
    if (a.type === "expense") {
      const row = spending.find((r) => r.account.id === a.id);
      const spent = formatGrouped(base, row?.spent ?? 0);
      return row?.target != null
        ? `${spent} of ${formatGrouped(base, row.target)} this month`
        : `${spent} this month`;
    }
    if (a.type === "asset" || a.type === "liability") {
      return `${formatGrouped(a.currency, accountSigned(a, lines))} left`;
    }
    return a.currency;
  }

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

  // Photograph a receipt and prefill from what the model read. Everything it
  // returns is a suggestion sitting in an editable form — the user still presses
  // Save, and the server still re-runs the balance invariant on the way in.
  async function scanReceipt() {
    setErr(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErr("Camera access is needed to scan a receipt");
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      // Compressed on-device: a full-resolution phone photo is several MB of
      // upload for no gain in what the model can read off a receipt.
      quality: 0.6,
      exif: false,
    });
    if (shot.canceled || !shot.assets?.[0]) return;

    setScanning(true);
    try {
      const draft = await authedApi.scanReceipt(shot.assets[0].uri);
      setDigits(String(draft.amount_minor));
      setAttachmentId(draft.attachment_id);
      setScanCurrency(draft.currency);
      if (draft.merchant) setMemo(draft.merchant);
      if (draft.txn_date) setTxnDate(new Date(`${draft.txn_date}T00:00:00`));
      // Scans are always spending; the category is the destination side.
      setMode("out");
      // Null category means the model was unsure. Leaving the picker empty makes
      // the user choose, which is the point — a confident wrong guess would just
      // get confirmed without being read.
      if (draft.category_id) setToId(draft.category_id);
      // Usable draft, just worth reading before confirming.
      setWarn(
        draft.confidence < LOW_CONFIDENCE
          ? "Low confidence — check the amount and date before saving"
          : null,
      );
    } catch (e) {
      setWarn(null);
      setErr(e instanceof Error ? e.message : "Could not read that receipt");
    } finally {
      setScanning(false);
    }
  }

  // Android's picker closes itself; iOS keeps ours open until "Done".
  function onDateChange(event: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS !== "ios") setDateOpen(false);
    if (event.type === "set" && picked) setTxnDate(picked);
  }

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
    // Both legs post in the source currency; cross-currency needs an fx_rate
    // this screen does not collect yet, and the server rejects the entry.
    if (from && to && from.currency !== to.currency) {
      setErr(`Both sides must use the same currency — ${from.name} is ${from.currency}, ${to.name} is ${to.currency}`);
      return;
    }
    // The scanned total is in the receipt's currency; the entry posts in the
    // source account's. Saving across the two would record 12.50 US dollars as
    // 1250 rupiah — same digits, wrong money — so it is refused rather than
    // silently converted, exactly as the cross-currency check above does.
    if (scanCurrency && scanCurrency !== currency) {
      setErr(`This receipt is in ${scanCurrency} but ${from?.name ?? "this account"} holds ${currency} — pick a ${scanCurrency} account`);
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
          e.txnDate = txnDate.getTime();
          e.status = "posted";
          e.currency = currency;
          e.source = attachmentId ? "receipt_scan" : "manual";
          e.memo = memo;
          // Carried out on the next push; that is when the server can file the
          // photo, because only then does this entry exist there.
          e.attachmentId = attachmentId;
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

  // Only worth saying when the entry is not already in the base currency.
  const converted = useMemo(() => {
    const minor = Number(digits || "0");
    if (currency === base || minor <= 0) return null;
    const inBase = convert(minor, currency, base, rates);
    return inBase == null
      ? null
      : `≈ ${formatGrouped(base, inBase)} ${base} · converted at today's rate`;
  }, [digits, currency, base, rates]);

  const pickOptions = picking === "from" ? fromOptions : toOptions;
  const empty = fromOptions.length === 0 || toOptions.length === 0;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
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
          helper={err ?? warn ?? converted ?? undefined}
          helperTone={err ? "error" : warn ? "warn" : "muted"}
        />

        <View className="border border-outline rounded-lg overflow-hidden">
          <PickerRow
            label={mode === "in" ? "from" : t("outOf").toLowerCase()}
            account={from}
            subtitle={from ? subtitleFor(from) : undefined}
            placeholder="Choose"
            onPress={() => setPicking("from")}
          />
          <View className="h-px bg-outline-variant" />
          <PickerRow
            label={t("into").toLowerCase()}
            account={to}
            subtitle={to ? subtitleFor(to) : undefined}
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
          <MetaChip glyph={Calendar} label={dateLabel(txnDate)} active onPress={() => setDateOpen(true)} />
          <MetaChip
            glyph={Camera}
            label={scanning ? "Reading…" : attachmentId ? "Receipt attached" : "Scan receipt"}
            active={!!attachmentId || scanning}
            onPress={scanning ? undefined : scanReceipt}
          />
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
            subtitle={subtitleFor(a)}
            onPress={() => {
              if (picking === "from") setFromId(a.id);
              else setToId(a.id);
              setPicking(null);
            }}
          />
        ))}
      </Sheet>

      {/* Capped at today: a receipt cannot be from the future. */}
      {dateOpen &&
        (Platform.OS === "ios" ? (
          <Sheet visible onClose={() => setDateOpen(false)} title="Transaction date">
            <DateTimePicker
              value={txnDate}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={onDateChange}
              textColor={C.ink}
            />
            <View className="mt-4">
              <Button label="Done" onPress={() => setDateOpen(false)} />
            </View>
          </Sheet>
        ) : (
          <DateTimePicker
            value={txnDate}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={onDateChange}
          />
        ))}

      <Sheet visible={noteOpen} onClose={() => setNoteOpen(false)} title="Note">
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="What was this for?"
          placeholderTextColor={C.disabled}
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

// "Today" reads better than a date the user already knows; anything else has to
// be shown, because a scanned receipt can be days old and posting it silently
// under the wrong date is exactly the mistake this screen should not make.
function dateLabel(d: Date): string {
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay ? "Today" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function PickerRow({
  label,
  account,
  subtitle,
  placeholder,
  onPress,
}: {
  label: string;
  account: Account | null;
  subtitle?: string;
  placeholder: string;
  onPress: () => void;
}) {
  const { C } = useTheme();
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
        {account && !!subtitle && (
          <Text className="text-caption font-sans-medium text-faint" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <ChevronRight size={18} color={C.chevron} strokeWidth={1.75} />
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
  const { C } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      className="flex-row items-center bg-surface-container rounded-full px-3.5 py-2"
      style={{ gap: 6 }}
    >
      <G size={14} color={active ? C.ink : C.dim} strokeWidth={1.75} />
      <Text className={`text-label font-sans-semibold ${active ? "text-ink" : "text-dim"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
