import { Tabs, router } from "expo-router";
import { Home, LayoutGrid, LineChart, MoreHorizontal } from "lucide-react-native";

import { TabBar, type TabSlot, useTheme } from "../../../src/components/ui";
import { useStrings, useWording } from "../../../src/lib/wording";

// Four destinations around the centre add affordance. The FAB is not a route —
// it pushes the add sheet — which is why the bar is hand-built rather than
// rendered from the navigator's descriptors.
export default function TabsLayout() {
  const { t } = useWording();
  const s = useStrings();
  const { C } = useTheme();

  const slots: TabSlot[] = [
    { name: "index", label: s.common.home, glyph: Home },
    { name: "history", label: t("history"), glyph: LineChart },
    { name: "buckets", label: t("buckets"), glyph: LayoutGrid },
    { name: "more", label: s.more.title, glyph: MoreHorizontal },
  ];

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.background } }}
      tabBar={({ state, navigation }) => (
        <TabBar
          slots={slots}
          activeName={state.routes[state.index]?.name ?? "index"}
          onSelect={(name) => navigation.navigate(name)}
          onAdd={() => router.push("/(app)/entry-new")}
          addLabel={t("addEntry")}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="buckets" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
