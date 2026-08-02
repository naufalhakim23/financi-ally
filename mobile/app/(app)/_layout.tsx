import { useEffect, useState } from "react";
import { type ColorValue, Text, View } from "react-native";
import { Tabs } from "expo-router";
import {
  ArrowUp,
  BarChart3,
  Home,
  PieChart,
  Repeat,
  Wallet,
} from "lucide-react-native";

import { syncDatabase } from "../../src/lib/sync";
import { refreshPending, useSyncState } from "../../src/lib/syncState";
import { Badge, Button, C } from "../../src/components/ui";

// Tab glyphs are Lucide at the default affordance size, inheriting the
// active/inactive tint expo-router hands down.
const tabIcon =
  (Glyph: typeof Home) =>
  ({ color }: { color: ColorValue }) => (
    <Glyph size={20} color={String(color)} strokeWidth={1.75} />
  );

// Authed app shell: five tabs, a Sync action in every header, and a status
// strip above the tab bar. Sync runs the WatermelonDB pull/push cycle; offline
// writes land here, online writes push.
export default function AppLayout() {
  const [syncing, setSyncing] = useState(false);
  const sync = useSyncState();

  // On mount, reflect writes from a previous session that never pushed.
  useEffect(() => {
    refreshPending();
  }, []);

  async function doSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncDatabase();
    } catch {
      // The failure is already in syncState and rendered in the strip below;
      // rethrowing here would only crash the shell.
    } finally {
      setSyncing(false);
    }
  }

  const headerRight = () => (
    <View className="flex-row items-center mr-2" style={{ gap: 8 }}>
      {sync.pending && !syncing && (
        <Badge tone="warning" glyph={ArrowUp}>
          pending
        </Badge>
      )}
      <Button
        label={syncing ? "Syncing…" : "Sync"}
        variant="tertiary"
        fullWidth={false}
        disabled={syncing}
        onPress={doSync}
      />
    </View>
  );

  // Rejected records outrank a transport failure: a 422 means the server
  // refused the entry, which needs the user — not a retry.
  const strip =
    sync.rejected > 0
      ? {
          tone: "bg-error-wash border-error-edge",
          text: "text-error",
          message: `${sync.rejected} ${sync.rejected === 1 ? "entry was" : "entries were"} rejected — review and re-enter`,
        }
      : sync.status === "error"
        ? {
            tone: "bg-warning-wash border-warning-edge",
            text: "text-warning",
            message: sync.pending
              ? "Offline — changes are saved on this device"
              : "Couldn't reach the server — will retry on next sync",
          }
        : null;

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
          headerRight,
          headerStyle: { backgroundColor: C.background },
          headerTitleStyle: {
            fontFamily: "Outfit-Bold",
            color: C.ink,
            fontSize: 20,
          },
          headerShadowVisible: false,
          tabBarActiveTintColor: C.primary,
          tabBarInactiveTintColor: C.faint,
          // Labels always visible — a glyph alone is not a label (DESIGN.md).
          tabBarLabelStyle: { fontFamily: "Outfit-SemiBold", fontSize: 11 },
          tabBarStyle: {
            backgroundColor: C.surface,
            borderTopColor: C.outline,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Home", tabBarIcon: tabIcon(Home) }}
        />
        <Tabs.Screen
          name="pockets"
          options={{ title: "Pockets", tabBarIcon: tabIcon(Wallet) }}
        />
        <Tabs.Screen
          name="budgets"
          options={{ title: "Budgets", tabBarIcon: tabIcon(PieChart) }}
        />
        <Tabs.Screen
          name="recurring"
          options={{ title: "Recurring", tabBarIcon: tabIcon(Repeat) }}
        />
        <Tabs.Screen
          name="reports"
          options={{ title: "Reports", tabBarIcon: tabIcon(BarChart3) }}
        />
        <Tabs.Screen name="entry-new" options={{ title: "Add entry", href: null }} />
        <Tabs.Screen name="pocket-new" options={{ title: "New pocket", href: null }} />
      </Tabs>

      {strip && (
        <View
          className={`absolute left-0 right-0 bottom-[76px] mx-4 rounded-xl border px-3 py-2 ${strip.tone}`}
          accessibilityLiveRegion="polite"
        >
          <Text className={`text-caption font-sans-semibold ${strip.text}`}>{strip.message}</Text>
        </View>
      )}
    </View>
  );
}
