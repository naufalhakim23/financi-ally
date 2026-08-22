import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_700Bold,
} from "@expo-google-fonts/ibm-plex-mono";

import { AuthProvider } from "../src/lib/auth";
import { hydrateTheme } from "../src/lib/theme";
import { WordingProvider } from "../src/lib/wording";

// Single QueryClient for the app lifetime (module scope, not per-render).
const queryClient = new QueryClient();

// Family keys here are the exact strings tailwind.config fontFamily resolves to.
// Both the `Sans` and `Mono` keys are deliberately face-agnostic — DESIGN.md
// picks the faces (Plus Jakarta Sans + IBM Plex Mono as of v2.1) and only this
// map changes when either moves. Through v2.0 the sans keys were literally
// "Outfit", so swapping the UI face meant editing tailwind.config.js too. It
// doesn't now: the mono convention won, and the sans follows it.
export default function RootLayout() {
  const [loaded] = useFonts({
    Sans: PlusJakartaSans_400Regular,
    "Sans-Medium": PlusJakartaSans_500Medium,
    "Sans-SemiBold": PlusJakartaSans_600SemiBold,
    "Sans-Bold": PlusJakartaSans_700Bold,
    Mono: IBMPlexMono_400Regular,
    "Mono-Medium": IBMPlexMono_500Medium,
    "Mono-Bold": IBMPlexMono_700Bold,
  });
  // The saved palette must be applied before the first frame, or the app opens
  // in the OS scheme and visibly repaints. Gated alongside the fonts, which
  // already hold the first render.
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    // Raced against a timeout: a storage read that never settles would
    // otherwise hold a blank screen forever over a cosmetic preference.
    Promise.race([hydrateTheme(), new Promise((r) => setTimeout(r, 2000))]).finally(() =>
      setThemeReady(true),
    );
  }, []);

  if (!loaded || !themeReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Screens draw their own headers, so they read the insets directly. */}
      <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* Above the Stack: the unauthenticated screens read the catalog too. */}
          <WordingProvider>
          <StatusBar style="auto" />
          {/* Every screen draws its own chrome — the app screens via
              ScreenHeader/TitleBar, the unauthenticated ones via AuthScreen.
              Leaving the stock header on login/register was the one place the
              app looked like two different products. */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(app)" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="reset-password" />
          </Stack>
          </WordingProvider>
        </AuthProvider>
      </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
