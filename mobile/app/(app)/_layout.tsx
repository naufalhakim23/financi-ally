import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";

import { syncDatabase } from "../../src/lib/sync";
import { refreshPending, useSyncState } from "../../src/lib/syncState";

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
    <View className="flex-row items-center mr-4" style={{ gap: 8 }}>
      {sync.pending && !syncing && (
        <View className="rounded-full bg-warning-soft border border-warning-border px-2 py-0.5">
          <Text className="text-warning text-[10px] font-sans-semibold">↑ pending</Text>
        </View>
      )}
      <Pressable onPress={doSync} disabled={syncing}>
        <Text className="text-info font-sans-semibold">{syncing ? "Syncing…" : "Sync"}</Text>
      </Pressable>
    </View>
  );

  // Rejected records outrank a transport failure: a 422 means the server
  // refused the entry, which needs the user — not a retry.
  const strip =
    sync.rejected > 0
      ? {
          tone: "bg-error-soft border-error-border",
          text: "text-error",
          message: `${sync.rejected} ${sync.rejected === 1 ? "entry was" : "entries were"} rejected — review and re-enter`,
        }
      : sync.status === "error"
        ? {
            tone: "bg-warning-soft border-warning-border",
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
          headerStyle: { backgroundColor: "#F2F3F7" },
          headerTitleStyle: {
            fontFamily: "Outfit-SemiBold",
            color: "#1A1F2E",
            fontSize: 15,
          },
          headerShadowVisible: false,
          tabBarActiveTintColor: "#1A1F2E",
          tabBarInactiveTintColor: "#9EA6BE",
          tabBarLabelStyle: { fontFamily: "Outfit-SemiBold", fontSize: 10 },
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "#E2E6F0",
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="pockets" options={{ title: "Pockets" }} />
        <Tabs.Screen name="budgets" options={{ title: "Budgets" }} />
        <Tabs.Screen name="recurring" options={{ title: "Recurring" }} />
        <Tabs.Screen name="reports" options={{ title: "Reports" }} />
        <Tabs.Screen name="entry-new" options={{ title: "Add entry", href: null }} />
        <Tabs.Screen name="pocket-new" options={{ title: "New pocket", href: null }} />
      </Tabs>

      {strip && (
        <View
          className={`absolute left-0 right-0 bottom-[76px] mx-4 rounded-xl border px-3 py-2 ${strip.tone}`}
          accessibilityLiveRegion="polite"
        >
          <Text className={`text-[11px] font-sans-semibold ${strip.text}`}>{strip.message}</Text>
        </View>
      )}
    </View>
  );
}
