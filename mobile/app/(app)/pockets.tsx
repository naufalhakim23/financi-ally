import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { accountSigned, netWorth } from "../../src/lib/balances";
import { format } from "../../src/lib/money";
import { useObservable } from "../../src/lib/useObserve";
import { Account, JournalLine } from "../../src/model/models";
import {
  Button,
  Card,
  EmptyState,
  ListRow,
  SectionLabel,
  Wallet,
  accountGlyph,
} from "../../src/components/ui";

const GROUPS: { title: string; types: string[] }[] = [
  { title: "Assets", types: ["asset"] },
  { title: "Liabilities", types: ["liability"] },
];

export default function Pockets() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const linesObs = useMemo(() => database.get<JournalLine>("journal_lines").query().observe(), []);
  const accounts = useObservable(accountsObs, [] as Account[]);
  const lines = useObservable(linesObs, [] as JournalLine[]);

  const worth = netWorth(accounts, lines);
  const pockets = accounts.filter(
    (a) => (a.type === "asset" || a.type === "liability") && !a.archived,
  );

  if (pockets.length === 0) {
    return (
      <View className="flex-1 bg-background justify-center px-4">
        <EmptyState
          glyph={Wallet}
          title="No pockets yet"
          body="Add the bank account, cash, or card your money actually sits in."
          actionLabel="Add a pocket"
          onAction={() => router.push("/(app)/pocket-new?first=1")}
        />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      {/* Net worth — neutral tone: a balance is not a gain or a loss. */}
      <Card className="mb-6">
        <SectionLabel>Net worth · {base}</SectionLabel>
        <Text className="text-ink text-amount-lg font-mono-bold mt-1">
          {base}&nbsp;{format(base, worth)}
        </Text>
      </Card>

      {GROUPS.map((g) => {
        const list = accounts.filter((a) => g.types.includes(a.type) && !a.archived);
        const subtotal = list.reduce((s, a) => s + accountSigned(a, lines), 0);
        return (
          <View key={g.title} className="mb-6">
            <View className="flex-row items-center justify-between mb-2 px-1">
              <SectionLabel>{g.title}</SectionLabel>
              <Text
                className={`text-amount-sm font-mono-bold ${
                  subtotal < 0 ? "text-error" : "text-ink"
                }`}
              >
                {base}&nbsp;{format(base, subtotal)}
              </Text>
            </View>
            {list.length === 0 ? (
              <Card>
                <Text className="text-faint text-body font-sans-medium">None</Text>
              </Card>
            ) : (
              <Card padded={false}>
                {list.map((a, i) => (
                  <ListRow
                    key={a.id}
                    divider={i > 0}
                    glyph={accountGlyph(a.name, a.type)}
                    title={a.name}
                    subtitle={a.currency}
                    amount={accountSigned(a, lines)}
                    currency={a.currency}
                    amountTone="neutral"
                  />
                ))}
              </Card>
            )}
          </View>
        );
      })}

      <Button
        label="New pocket"
        variant="secondary"
        onPress={() => router.push("/(app)/pocket-new")}
      />
    </ScrollView>
  );
}
