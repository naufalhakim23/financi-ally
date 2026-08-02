import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowUp,
  BarChart3,
  Lock,
  LogOut,
  PieChart,
  RefreshCw,
  Repeat,
  Type,
  Wallet,
} from "lucide-react-native";

import { useAuth } from "../../../src/lib/auth";
import { syncDatabase } from "../../../src/lib/sync";
import { useSyncState } from "../../../src/lib/syncState";
import { useWording } from "../../../src/lib/wording";
import { Badge, BookOpen, Button, Card, ListRow, SectionLabel, TitleBar, Users } from "../../../src/components/ui";
import { useLedgerState } from "../../../src/lib/ledgerStore";

// Everything direction 2a does not give a tab. Budgets, recurring rules and
// reports still exist — they just stopped being destinations of their own.
export default function MoreScreen() {
  const { user, guest, logout } = useAuth();
  const { mode } = useWording();
  // null means the personal book; only a household name is worth showing.
  const { active: activeLedger } = useLedgerState();
  const sync = useSyncState();
  const [syncing, setSyncing] = useState(false);

  async function doSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncDatabase();
    } catch {
      // Already reflected in the status strip; rethrowing would crash the tab.
    } finally {
      setSyncing(false);
    }
  }

  // Books, the spending plan, repeating rules and reports are computed and
  // stored server-side. A guest has no server, so the rows say so and lead to
  // sign-up instead of opening a screen that can only fail.
  const gated = (subtitle: string, href: Parameters<typeof router.push>[0]) =>
    guest
      ? {
          subtitle: "Sign in to unlock",
          chevronGlyph: Lock,
          onPress: () => router.push("/register"),
        }
      : { subtitle, onPress: () => router.push(href) };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <TitleBar title="More" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Card padded={false}>
          <ListRow
            glyph={activeLedger ? Users : BookOpen}
            title="Books"
            chevron
            {...gated(
              activeLedger ? `${activeLedger.name} · shared` : "Personal · private to you",
              "/(app)/ledgers",
            )}
          />
          <ListRow
            divider
            glyph={Type}
            title="How it is worded"
            subtitle={mode === "finance" ? "Finance" : "Normal"}
            chevron
            onPress={() => router.push("/(app)/wording")}
          />
          <ListRow
            divider
            glyph={PieChart}
            title="The spending plan"
            chevron
            {...gated("Set what each category may take", "/(app)/budgets")}
          />
          <ListRow
            divider
            glyph={Repeat}
            title="Repeating entries"
            chevron
            {...gated("Rent, salary, subscriptions", "/(app)/recurring")}
          />
          <ListRow
            divider
            glyph={BarChart3}
            title="Reports"
            chevron
            {...gated("Cash flow and category breakdown", "/(app)/reports")}
          />
          <ListRow
            divider
            glyph={Wallet}
            title="Add a pocket"
            subtitle="A bank account, cash, a card"
            chevron
            onPress={() => router.push("/(app)/pocket-new")}
          />
        </Card>

        <SectionLabel>this device</SectionLabel>
        {guest ? (
          <>
            <Card>
              <Text className="text-body-strong font-sans-semibold text-ink">
                Everything is on this phone
              </Text>
              <Text className="text-caption font-sans-medium text-faint mt-1 mb-4">
                Nothing has left the device. Make an account and what you have entered comes with
                you — plus reports, the spending plan and shared books.
              </Text>
              <Button label="Create an account" onPress={() => router.push("/register")} />
            </Card>
            <View className="mt-2">
              <Button
                label="I already have an account"
                variant="tertiary"
                onPress={() => router.push("/login")}
              />
            </View>
          </>
        ) : (
          <>
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-body-strong font-sans-semibold text-ink">Sync</Text>
              <Text className="text-caption font-sans-medium text-faint mt-0.5">
                {user?.email ?? "signed in"}
              </Text>
            </View>
            {sync.pending && !syncing && (
              <View className="mr-2">
                <Badge tone="warning" glyph={ArrowUp}>
                  pending
                </Badge>
              </View>
            )}
            <Button
              label={syncing ? "Syncing…" : "Sync now"}
              variant="secondary"
              glyph={RefreshCw}
              fullWidth={false}
              disabled={syncing}
              onPress={doSync}
            />
          </View>
        </Card>

        <View className="mt-2">
          <Button label="Sign out" variant="destructive" glyph={LogOut} onPress={logout} />
        </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
