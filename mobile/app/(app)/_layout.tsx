import { useEffect } from "react";
import { Text, View } from "react-native";
import { Stack } from "expo-router";

import { useTheme } from "../../src/components/ui";
import { refreshPending, useSyncState } from "../../src/lib/syncState";
import { WordingProvider } from "../../src/lib/wording";

// Authed shell. The tab group owns the four destinations; everything pushed on
// top of them — details, the add sheet, settings — lives here so it arrives
// without the tab bar under it.
//
// Screens draw their own headers (ScreenHeader / TitleBar) rather than the
// navigator's: direction 2a puts a back label, a title and an action on one
// row, which the stock header cannot lay out.
export default function AppLayout() {
  const sync = useSyncState();
  const { C } = useTheme();

  // On mount, reflect writes from a previous session that never pushed.
  useEffect(() => {
    refreshPending();
  }, []);

  // Rejected records outrank a transport failure: a 422 means the server
  // refused the entry, which needs the user — not a retry.
  const strip =
    sync.rejected > 0
      ? {
          tone: "bg-error-wash border-error-edge",
          text: "text-error-strong",
          message: `${sync.rejected} ${sync.rejected === 1 ? "entry was" : "entries were"} rejected — review and re-enter`,
        }
      : sync.status === "error"
        ? {
            tone: "bg-warning-wash border-warning-edge",
            text: "text-warning-strong",
            message: sync.pending
              ? "Offline — changes are saved on this device"
              : "Couldn't reach the server — will retry on next sync",
          }
        : null;

  return (
    <WordingProvider>
      <View className="flex-1 bg-background">
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.background } }}>
          <Stack.Screen name="(tabs)" />
          {/* The add flow is a sheet in the hi-fi, not a full page: react-native-screens
              gives us the scrim, the grabber and the rounded top natively, so the
              screen itself only draws its content. */}
          <Stack.Screen
            name="entry-new"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.96],
              sheetGrabberVisible: true,
              sheetCornerRadius: 20,
            }}
          />
          <Stack.Screen name="pocket-new" options={{ presentation: "modal" }} />
          <Stack.Screen name="month/[month]" />
          <Stack.Screen name="entry/[id]" />
          <Stack.Screen name="wording" />
          <Stack.Screen name="appearance" />
          <Stack.Screen name="budgets" />
          <Stack.Screen name="recurring" />
          <Stack.Screen name="ledgers" />
          <Stack.Screen name="reports" />
        </Stack>

        {strip && (
          <View
            className={`absolute left-0 right-0 bottom-[92px] mx-4 rounded-xl border px-3 py-2 ${strip.tone}`}
            accessibilityLiveRegion="polite"
          >
            <Text className={`text-caption font-sans-semibold ${strip.text}`}>{strip.message}</Text>
          </View>
        )}
      </View>
    </WordingProvider>
  );
}
