import { useState } from "react";
import { Pressable, Text } from "react-native";
import { Tabs } from "expo-router";

import { syncDatabase } from "../../src/lib/sync";

// Authed app shell: four tabs + a Sync action in every header. Sync runs the
// WatermelonDB pull/push cycle; offline writes land here, online writes push.
export default function AppLayout() {
  const [syncing, setSyncing] = useState(false);

  async function doSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncDatabase();
    } catch (e) {
      // ponytail: log sync failures for now; a visible "sync failed, review"
      // banner is later polish. Per-record push errors are logged in sync.ts.
      console.warn("[sync] failed", e);
    } finally {
      setSyncing(false);
    }
  }

  const headerRight = () => (
    <Pressable onPress={doSync} disabled={syncing} className="mr-4">
      <Text className="text-info font-sans-semibold">
        {syncing ? "Syncing…" : "Sync"}
      </Text>
    </Pressable>
  );

  return (
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
      <Tabs.Screen name="reports" options={{ title: "Reports" }} />
      <Tabs.Screen name="entry-new" options={{ title: "Add entry", href: null }} />
    </Tabs>
  );
}
