import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowUp,
  BarChart3,
  Lock,
  LogOut,
  Palette,
  PieChart,
  RefreshCw,
  Repeat,
  Type,
  Wallet,
} from "lucide-react-native";

import { useAuth } from "../../../src/lib/auth";
import { syncDatabase } from "../../../src/lib/sync";
import { useSyncState } from "../../../src/lib/syncState";
import { useThemePreference } from "../../../src/lib/theme";
import { useStrings, useWording } from "../../../src/lib/wording";
import { Badge, BookOpen, Button, Card, ListRow, SectionLabel, TitleBar, Users } from "../../../src/components/ui";
import { useLedgerState } from "../../../src/lib/ledgerStore";

// Everything direction 2a does not give a tab. Budgets, recurring rules and
// reports still exist — they just stopped being destinations of their own.
export default function MoreScreen() {
  const { user, guest, logout } = useAuth();
  const { mode } = useWording();
  const s = useStrings();
  const themePref = useThemePreference();
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
          subtitle: s.more.lockedSubtitle,
          chevronGlyph: Lock,
          onPress: () => router.push("/register"),
        }
      : { subtitle, onPress: () => router.push(href) };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <TitleBar title={s.more.title} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Card padded={false}>
          <ListRow
            glyph={activeLedger ? Users : BookOpen}
            title={s.more.books}
            chevron
            {...gated(
              activeLedger ? s.more.booksShared(activeLedger.name) : s.more.booksPersonal,
              "/(app)/ledgers",
            )}
          />
          <ListRow
            divider
            glyph={Type}
            title={s.more.wording}
            subtitle={mode === "finance" ? s.more.wordingFinance : s.more.wordingNormal}
            chevron
            onPress={() => router.push("/(app)/wording")}
          />
          <ListRow
            divider
            glyph={Palette}
            title={s.more.appearance}
            subtitle={
              themePref === "system"
                ? s.more.appearanceSystem
                : themePref === "dark"
                  ? s.more.appearanceDark
                  : s.more.appearanceLight
            }
            chevron
            onPress={() => router.push("/(app)/appearance")}
          />
          <ListRow
            divider
            glyph={PieChart}
            title={s.more.plan}
            chevron
            {...gated(s.more.planSubtitle, "/(app)/budgets")}
          />
          <ListRow
            divider
            glyph={Repeat}
            title={s.more.repeating}
            chevron
            {...gated(s.more.repeatingSubtitle, "/(app)/recurring")}
          />
          <ListRow
            divider
            glyph={BarChart3}
            title={s.more.reports}
            chevron
            {...gated(s.more.reportsSubtitle, "/(app)/reports")}
          />
          <ListRow
            divider
            glyph={Wallet}
            title={s.more.addPocket}
            subtitle={s.more.addPocketSubtitle}
            chevron
            onPress={() => router.push("/(app)/pocket-new")}
          />
        </Card>

        <SectionLabel>{s.more.thisDevice}</SectionLabel>
        {guest ? (
          <>
            <Card>
              <Text className="text-body-strong font-sans-semibold text-ink">
                {s.more.guest.title}
              </Text>
              <Text className="text-caption font-sans-medium text-faint mt-1 mb-4">
                {s.more.guest.body}
              </Text>
              <Button
                label={s.more.guest.createAccount}
                onPress={() => router.push("/register")}
              />
            </Card>
            <View className="mt-2">
              <Button
                label={s.more.guest.haveAccount}
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
              <Text className="text-body-strong font-sans-semibold text-ink">{s.more.sync}</Text>
              <Text className="text-caption font-sans-medium text-faint mt-0.5">
                {user?.email ?? s.more.signedIn}
              </Text>
            </View>
            {sync.pending && !syncing && (
              <View className="mr-2">
                <Badge tone="warning" glyph={ArrowUp}>
                  {s.more.pending}
                </Badge>
              </View>
            )}
            <Button
              label={syncing ? s.more.syncing : s.more.syncNow}
              variant="secondary"
              glyph={RefreshCw}
              fullWidth={false}
              disabled={syncing}
              onPress={doSync}
            />
          </View>
        </Card>

        <View className="mt-2">
          <Button label={s.more.signOut} variant="destructive" glyph={LogOut} onPress={logout} />
        </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
