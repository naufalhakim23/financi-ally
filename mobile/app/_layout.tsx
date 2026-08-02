import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_700Bold,
} from "@expo-google-fonts/ibm-plex-mono";

import { AuthProvider } from "../src/lib/auth";

// Single QueryClient for the app lifetime (module scope, not per-render).
const queryClient = new QueryClient();

// Family keys here are the exact strings tailwind.config fontFamily resolves to.
// The `Mono` keys are deliberately face-agnostic — DESIGN.md picks the numeral
// face (IBM Plex Mono as of v1.1) and only this map changes when it moves.
export default function RootLayout() {
  const [loaded] = useFonts({
    Outfit: Outfit_400Regular,
    "Outfit-Medium": Outfit_500Medium,
    "Outfit-SemiBold": Outfit_600SemiBold,
    "Outfit-Bold": Outfit_700Bold,
    Mono: IBMPlexMono_400Regular,
    "Mono-Medium": IBMPlexMono_500Medium,
    "Mono-Bold": IBMPlexMono_700Bold,
  });
  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Screens draw their own headers, so they read the insets directly. */}
      <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="auto" />
          <Stack>
            <Stack.Screen name="index" />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: "Sign in" }} />
            <Stack.Screen name="register" options={{ title: "Create account" }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
