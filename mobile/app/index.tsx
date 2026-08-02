import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";

import { useTheme } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";

// Entry gate. While tokens hydrate we show a spinner; a session or an active
// guest lands in the (app) tab group, and everyone else meets /welcome — which
// offers using the app without an account before it offers signing in.
export default function Home() {
  const { user, guest, loading } = useAuth();
  const { C } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (user || guest) router.replace("/(app)");
    else router.replace("/welcome");
  }, [loading, user, guest]);

  return (
    // bg-background, not a hardcoded white: this is the very first frame the
    // app draws, and in dark mode a white flash is the most visible bug there is.
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator color={C.dim} />
    </View>
  );
}
