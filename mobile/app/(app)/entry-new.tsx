import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { AmountField, Picker, PrimaryButton } from "../../src/components/forms";
import { EmptyState } from "../../src/components/ui";
import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { toMinor } from "../../src/lib/money";
import { syncDatabase } from "../../src/lib/sync";
import { useObservable } from "../../src/lib/useObserve";
import { Account } from "../../src/model/models";

export default function EntryNew() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const accounts = useObservable(accountsObs, [] as Account[]);
  const assets = accounts.filter((a) => a.type === "asset" && !a.archived);
  const expenses = accounts.filter((a) => a.type === "expense" && !a.archived);

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [fromId, setFromId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!fromId || !categoryId) {
      setErr("Pick a pocket and a category");
      return;
    }
    let minor: number;
    try {
      minor = toMinor(base, amount);
    } catch {
      setErr("Enter a valid amount");
      return;
    }
    if (minor <= 0) {
      setErr("Amount must be greater than zero");
      return;
    }
    setBusy(true);
    try {
      // Balanced single-currency entry: debit the category, credit the pocket.
      // Written to local WatermelonDB first (works offline); sync pushes it,
      // where the server re-runs the balance invariant.
      await database.write(async () => {
        const entry = await database.get("entries").create((e: any) => {
          e.txnDate = Date.now();
          e.status = "posted";
          e.currency = base;
          e.source = "manual";
          e.memo = memo;
        });
        await database.get("journal_lines").create((l: any) => {
          l.entryId = entry.id;
          l.accountId = categoryId;
          l.dc = "debit";
          l.amountMinor = minor;
          l.currency = base;
        });
        await database.get("journal_lines").create((l: any) => {
          l.entryId = entry.id;
          l.accountId = fromId;
          l.dc = "credit";
          l.amountMinor = minor;
          l.currency = base;
        });
      });
      try {
        await syncDatabase();
      } catch (e) {
        // Offline is fine — the entry is local; it syncs on the next cycle.
        console.warn("[entry] sync deferred", e);
      }
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  const empty = assets.length === 0 || expenses.length === 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {empty && (
          <View className="mb-4">
            <EmptyState
              icon="👛"
              title="Set up a pocket first"
              body="An entry moves money from a pocket into a category — you need one of each."
              actionLabel="Create a pocket"
              onAction={() => router.push("/(app)/pocket-new?first=1")}
            />
          </View>
        )}

        <AmountField label="Amount" value={amount} onChange={setAmount} currency={base} />

        <Picker
          label="From pocket (credit)"
          value={fromId}
          options={assets.map((a) => ({ value: a.id, label: a.name }))}
          onSelect={setFromId}
        />
        <Picker
          label="To category (debit)"
          value={categoryId}
          options={expenses.map((a) => ({ value: a.id, label: a.name }))}
          onSelect={setCategoryId}
        />

        {err && <Text className="text-error text-sm mb-3">{err}</Text>}

        <PrimaryButton label="Save" onPress={save} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
