import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AmountField,
  Button,
  Field,
  ScreenHeader,
  SegmentedControl,
} from "../../src/components/ui";
import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { isAlpha3, toMinor } from "../../src/lib/money";
import { syncDatabase } from "../../src/lib/sync";
import { useObservable } from "../../src/lib/useObserve";
import { Account, AccountType, Entry, JournalLine } from "../../src/model/models";

const EQUITY_ACCOUNT_NAME = "Opening Balances";

type PocketType = Extract<AccountType, "asset" | "liability">;

/**
 * Create a pocket, optionally with an opening balance.
 *
 * An opening balance is not money from nowhere — it is a balanced entry against
 * an equity account, which is how the ledger stays provable from day one. Asset
 * pockets debit the pocket and credit equity; liability pockets (you already
 * owe something) do the reverse.
 *
 * Exactly one pocket, nothing else. Seeding a starter chart is the setup
 * wizard's job — gating it on a query param here meant two of the three routes
 * into this screen produced a ledger with no categories at all.
 */
export default function PocketNew() {
  const { baseCurrency: base } = useAuth();

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const accounts = useObservable(accountsObs, [] as Account[]);

  const [name, setName] = useState("");
  const [type, setType] = useState<PocketType>("asset");
  const [currency, setCurrency] = useState(base);
  const [opening, setOpening] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Give the pocket a name");
      return;
    }
    const cur = currency.trim().toUpperCase();
    if (!isAlpha3(cur)) {
      setErr("Currency must be a 3-letter code (e.g. IDR)");
      return;
    }
    let openingMinor = 0;
    if (opening.trim()) {
      try {
        openingMinor = toMinor(cur, opening);
      } catch {
        setErr("Enter a valid opening balance");
        return;
      }
    }

    setBusy(true);
    try {
      await database.write(async () => {
        const mkAccount = (t: AccountType, n: string, c: string) =>
          database.get<Account>("accounts").create((a) => {
            a.type = t;
            a.currency = c;
            a.name = n;
            a.parentId = null;
            a.archived = false;
          });

        const pocket = await mkAccount(type, trimmed, cur);

        if (openingMinor > 0) {
          // One equity account per currency — an entry's legs balance
          // per-currency, so a shared equity account can't straddle two.
          const existingEquity = accounts.find(
            (a) => a.type === "equity" && a.currency === cur && a.name === EQUITY_ACCOUNT_NAME,
          );
          const equity = existingEquity ?? (await mkAccount("equity", EQUITY_ACCOUNT_NAME, cur));

          const entry = await database.get<Entry>("entries").create((e) => {
            e.txnDate = new Date();
            e.status = "posted";
            e.currency = cur;
            e.source = "manual";
            e.memo = `Opening balance · ${trimmed}`;
          });
          const line = (accountId: string, dc: "debit" | "credit") =>
            database.get<JournalLine>("journal_lines").create((l) => {
              l.entryId = entry.id;
              l.accountId = accountId;
              l.dc = dc;
              l.amountMinor = openingMinor;
              l.currency = cur;
            });
          // Asset: you hold it (debit pocket / credit equity).
          // Liability: you owe it (credit pocket / debit equity).
          if (type === "asset") {
            await line(pocket.id, "debit");
            await line(equity.id, "credit");
          } else {
            await line(equity.id, "debit");
            await line(pocket.id, "credit");
          }
        }
      });

      try {
        await syncDatabase();
      } catch (e) {
        // Offline is fine — everything above is local; it pushes next cycle.
        console.warn("[pocket-new] sync deferred", e);
      }
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not create the pocket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <SafeAreaView edges={["top"]}>
        <ScreenHeader title="New pocket" backLabel="Back" onBack={() => router.back()} />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4">
          <Text className="text-label font-sans-semibold text-ink mb-1.5">Kind</Text>
          <SegmentedControl
            options={[
              { value: "asset", label: "I hold this" },
              { value: "liability", label: "I owe this" },
            ]}
            value={type}
            onChange={setType}
          />
        </View>

        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="BCA Checking"
          autoCap="sentences"
        />
        <Field
          label="Currency"
          value={currency}
          onChange={setCurrency}
          placeholder={base}
          autoCap="characters"
        />
        <AmountField
          label={type === "asset" ? "Opening balance (optional)" : "Amount owed (optional)"}
          value={opening}
          onChange={setOpening}
          currency={currency.trim().toUpperCase() || base}
          error={err}
        />

        <Button label="Create pocket" onPress={save} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
