import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { accountSigned, netWorth } from "../../src/lib/balances";
import { format } from "../../src/lib/money";
import { useObservable } from "../../src/lib/useObserve";
import { Account, JournalLine } from "../../src/model/models";
import { Card, EmptyState, IconBox, SectionLabel } from "../../src/components/ui";

const GROUPS: { title: string; types: string[]; icon: string }[] = [
  { title: "Assets", types: ["asset"], icon: "💵" },
  { title: "Liabilities", types: ["liability"], icon: "💳" },
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
          icon="👛"
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
      {/* Net worth */}
      <Card className="mb-4">
        <SectionLabel>Net worth · {base}</SectionLabel>
        <Text className="text-ink text-[26px] font-mono-bold mt-1 leading-tight">
          {format(base, worth)}
        </Text>
      </Card>

      {GROUPS.map((g) => {
        const list = accounts.filter((a) => g.types.includes(a.type) && !a.archived);
        const subtotal = list.reduce((s, a) => s + accountSigned(a, lines), 0);
        return (
          <View key={g.title} className="mb-4">
            <View className="flex-row items-center justify-between mb-2 px-1">
              <SectionLabel>{g.title}</SectionLabel>
              <Text
                className={`text-[11px] font-mono-bold ${
                  subtotal < 0 ? "text-error" : "text-ink"
                }`}
              >
                {format(base, subtotal)}
              </Text>
            </View>
            {list.length === 0 ? (
              <Card>
                <Text className="text-faint text-sm">None</Text>
              </Card>
            ) : (
              <Card padded={false}>
                {list.map((a, i) => {
                  const signed = accountSigned(a, lines);
                  const last = i === list.length - 1;
                  return (
                    <View
                      key={a.id}
                      className={`flex-row items-center px-4 py-3 ${
                        last ? "" : "border-b border-outline-variant"
                      }`}
                      style={{ gap: 10 }}
                    >
                      <IconBox bg="bg-secondary">{g.icon}</IconBox>
                      <Text className="flex-1 text-ink text-[13px] font-sans-medium">
                        {a.name}
                      </Text>
                      <Text
                        className={`text-[13px] font-mono-bold ${
                          signed < 0 ? "text-error" : "text-ink"
                        }`}
                      >
                        {format(a.currency, signed)}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            )}
          </View>
        );
      })}

      <Pressable
        onPress={() => router.push("/(app)/pocket-new")}
        className="border border-outline bg-surface rounded-xl py-4 items-center"
      >
        <Text className="text-ink text-[13px] font-sans-semibold">＋ New pocket</Text>
      </Pressable>
    </ScrollView>
  );
}
