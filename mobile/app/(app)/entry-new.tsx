import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronRight, Plus } from "lucide-react-native";

import { authedApi } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { accountSigned } from "../../src/lib/balances";
import { spendingForMonth } from "../../src/lib/buckets";
import { database } from "../../src/lib/db";
import { messageFor } from "../../src/lib/errors";
import { createAccount } from "../../src/lib/setup";
import { EMPTY_RATES, convert, type RateTable } from "../../src/lib/fx";
import { syncDatabase } from "../../src/lib/sync";
import { useObservable } from "../../src/lib/useObserve";
import { useStrings, useWording } from "../../src/lib/wording";
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
  haptic,
  ICON,
  useTheme,
} from "../../src/components/ui";

type Mode = "out" | "in" | "move";

const LAST_FROM_KEY = "entry.lastFrom";

// Which account types each side of the entry may point at. An entry is always
// a balanced pair, so the mode fully determines both sides' candidates.
const SIDES: Record<Mode, { from: string[]; to: string[] }> = {
  out: { from: ["asset", "liability"], to: ["expense"] },
  in: { from: ["income"], to: ["asset"] },
  move: { from: ["asset", "liability"], to: ["asset", "liability"] },
};

// Where to send them when a side has nothing to offer. Categories and income
// sources have no create screen of their own on this client — the setup wizard
// is where they come from. The copy lives in the catalog under `entry.new.need`.
const NEED_HREF = {
  pocket: "/(app)/pocket-new",
  expense: "/(app)/setup",
  income: "/(app)/setup",
} as const;

export default function EntryNew() {
  const params = useLocalSearchParams<{ mode?: string; from?: string; to?: string; amount?: string }>();
  const { guest, baseCurrency: base } = useAuth();
  const { t, showSides } = useWording();
  const s = useStrings();
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
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatBusy, setNewCatBusy] = useState(false);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        ? s.entry.new.categoryOfTarget(spent, formatGrouped(base, row.target))
        : s.entry.new.categorySpent(spent);
    }
    if (a.type === "asset" || a.type === "liability") {
      return s.entry.new.pocketLeft(formatGrouped(a.currency, accountSigned(a, lines)));
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
  }, [mode, accounts]);

  // Fills a blank only: a deep-link param or the user's own pick always wins.
  useEffect(() => {
    if (fromId || mode === "in" || accounts.length === 0) return;
    let stale = false;
    void database.localStorage.get<string>(LAST_FROM_KEY).then((saved) => {
      if (stale || !saved) return;
      setFromId((cur) => (cur ? cur : fromOptions.some((a) => a.id === saved) ? saved : cur));
    });
    return () => {
      stale = true;
    };
  }, [accounts.length, mode]);

  // Resolved against the options, not all accounts: an id that arrived by deep
  // link or went stale when an account was archived resolves to null and never
  // reaches save().
  const from = fromOptions.find((a) => a.id === fromId) ?? null;
  const to = toOptions.find((a) => a.id === toId) ?? null;
  const currency = from?.currency ?? base;

  function reject(msg: string) {
    haptic.warn();
    setErr(msg);
  }

  async function save() {
    setErr(null);
    if (!from || !to) {
      reject(s.entry.new.errors.pickBoth(mode));
      return;
    }
    if (from.id === to.id) {
      reject(s.entry.new.errors.sameAccount);
      return;
    }
    // Both legs post in the source currency; cross-currency needs an fx_rate
    // this screen does not collect yet, and the server rejects the entry.
    if (from.currency !== to.currency) {
      reject(
        s.entry.new.errors.currencyMismatch(from.name, from.currency, to.name, to.currency),
      );
      return;
    }
    const minor = Number(digits || "0");
    if (!Number.isSafeInteger(minor)) {
      reject(s.entry.new.errors.badAmount);
      return;
    }
    if (minor <= 0) {
      reject(s.entry.new.errors.zeroAmount);
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
          l.accountId = to.id;
          l.dc = "debit";
          l.amountMinor = minor;
          l.currency = currency;
        });
        await database.get("journal_lines").create((l: any) => {
          l.entryId = entry.id;
          l.accountId = from.id;
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
      haptic.success();
      if (mode !== "in") void database.localStorage.set(LAST_FROM_KEY, from.id);
      router.back();
    } catch (e) {
      haptic.error();
      setErr(messageFor(e, s.entry.new.errors.saveFailed));
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
      : s.entry.new.convertedAt(formatGrouped(base, inBase), base);
  }, [digits, currency, base, rates, s]);

  const pickOptions = picking === "from" ? fromOptions : toOptions;
  // Which side is actually empty, not just "something is". Saying "set up a
  // pocket first" to someone who has three pockets and no categories sends them
  // to create a fourth pocket and hit the same wall.
  const missingKind =
    fromOptions.length === 0
      ? mode === "in"
        ? ("income" as const)
        : ("pocket" as const)
      : toOptions.length === 0
        ? mode === "out"
          ? ("expense" as const)
          : ("pocket" as const)
        : null;
  const missing = missingKind ? s.entry.new.need[missingKind] : null;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} accessibilityRole="button" className="min-h-touch justify-center">
          <Text className="text-body-strong font-sans-semibold text-dim">{s.common.cancel}</Text>
        </Pressable>
        <Text className="text-headline font-sans-semibold text-ink">{t("addEntry")}</Text>
        <Pressable
          onPress={save}
          disabled={busy || !!missing}
          accessibilityRole="button"
          className="min-h-touch justify-center"
        >
          <Text
            className={`text-body-strong font-sans-semibold ${missing ? "text-disabled" : "text-info"}`}
          >
            {s.entry.new.save}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {missing && missingKind && (
          <EmptyState
            glyph={Wallet}
            title={missing.title}
            body={missing.body}
            actionLabel={missing.action}
            onAction={() => router.push(NEED_HREF[missingKind])}
          />
        )}

        <SegmentedControl
          value={mode}
          onChange={(m) => setMode(m as Mode)}
          options={[
            { value: "out", label: s.entry.new.modes.out },
            { value: "in", label: s.entry.new.modes.in },
            { value: "move", label: s.entry.new.modes.move },
          ]}
        />

        <AmountWell
          currency={currency}
          display={digits ? formatGrouped(currency, Number(digits)) : ""}
          helper={err ?? converted ?? undefined}
        />

        <View className="border border-outline rounded-lg overflow-hidden">
          <PickerRow
            label={mode === "in" ? s.entry.new.from : t("outOf").toLowerCase()}
            account={from}
            subtitle={from ? subtitleFor(from) : undefined}
            placeholder={s.entry.new.choose}
            onPress={() => setPicking("from")}
          />
          {mode !== "out" && (
            <>
              <View className="h-px bg-outline-variant" />
              <PickerRow
                label={t("into").toLowerCase()}
                account={to}
                subtitle={to ? subtitleFor(to) : undefined}
                placeholder={s.entry.new.choose}
                onPress={() => setPicking("to")}
              />
            </>
          )}
        </View>

        {mode === "out" && toOptions.length > 0 && (
          <CategoryRail
            label={t("into").toLowerCase()}
            options={toOptions}
            selectedId={toId}
            onSelect={(id) => {
              haptic.tap();
              setToId(id);
            }}
            onAdd={() => setNewCatOpen(true)}
          />
        )}

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
          <MetaChip glyph={Calendar} label={s.entry.new.today} active />
          <MetaChip
            glyph={Plus}
            label={memo ? s.entry.new.noteAdded : s.entry.new.note}
            active={!!memo}
            onPress={() => setNoteOpen(true)}
          />
        </View>

        <Keypad onKey={(k: KeypadKey) => setDigits((d) => applyKey(d, k))} />

        <Button
          label={s.entry.new.saveAction}
          onPress={save}
          busy={busy}
          disabled={!!missing}
        />
      </ScrollView>

      <Sheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === "from" ? s.entry.new.pickFrom : s.entry.new.pickTo}
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

      <Sheet
        visible={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        title={s.entry.new.newCategory}
      >
        <TextInput
          value={newCatName}
          onChangeText={setNewCatName}
          placeholder={s.entry.new.newCategoryPlaceholder}
          placeholderTextColor={C.disabled}
          autoFocus
          className="bg-surface-container rounded-lg px-4 py-3 min-h-touch text-body font-sans-medium text-ink"
        />
        <View className="mt-4">
          <Button
            label={s.entry.new.addCategory}
            busy={newCatBusy}
            disabled={!newCatName.trim()}
            onPress={async () => {
              setNewCatBusy(true);
              try {
                // Must match the source pocket's currency or Save rejects the pair.
                const id = await createAccount("expense", newCatName.trim(), currency);
                haptic.success();
                setToId(id);
                setNewCatOpen(false);
                setNewCatName("");
              } catch (e) {
                haptic.error();
                setErr(messageFor(e, s.entry.new.addCategoryFailed));
                setNewCatOpen(false);
              } finally {
                setNewCatBusy(false);
              }
            }}
          />
        </View>
      </Sheet>

      <Sheet visible={noteOpen} onClose={() => setNoteOpen(false)} title={s.entry.new.note}>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder={s.entry.new.notePlaceholder}
          placeholderTextColor={C.disabled}
          autoFocus
          className="bg-surface-container rounded-lg px-4 py-3 min-h-touch text-body font-sans-medium text-ink"
        />
        <View className="mt-4">
          <Button label={s.common.done} onPress={() => setNoteOpen(false)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function CategoryRail({
  label,
  options,
  selectedId,
  onSelect,
  onAdd,
}: {
  label: string;
  options: Account[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const s = useStrings();
  return (
    <View style={{ gap: 8 }}>
      <Text className="text-overline font-sans-semibold text-faint uppercase px-1">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {options.map((a) => {
          const active = a.id === selectedId;
          return (
            <Pressable
              key={a.id}
              onPress={() => onSelect(a.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={s.entry.new.railCategory(a.name)}
              className={`items-center rounded-xl border px-2 py-2 ${
                active ? "border-primary bg-surface-container" : "border-outline bg-surface"
              }`}
              style={{ width: 76, gap: 6 }}
            >
              <IconBox glyph={accountGlyph(a.name, a.type)} slot={categorySlot(a.id)} size={32} />
              <Text
                className={`text-caption font-sans-semibold ${active ? "text-ink" : "text-dim"}`}
                numberOfLines={1}
              >
                {a.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={s.entry.new.newCategory}
          className="items-center justify-center rounded-xl border border-outline bg-surface px-2 py-2"
          style={{ width: 76, gap: 6 }}
        >
          <IconBox glyph={Plus} size={32} />
          <Text className="text-caption font-sans-semibold text-dim">{s.entry.new.railNew}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
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
      <ChevronRight size={ICON.lg} color={C.chevron} strokeWidth={1.75} />
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
      <G size={ICON.sm} color={active ? C.ink : C.dim} strokeWidth={1.75} />
      <Text className={`text-label font-sans-semibold ${active ? "text-ink" : "text-dim"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
