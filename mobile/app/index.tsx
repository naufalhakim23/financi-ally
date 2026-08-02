import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";

import { useAuth } from "../src/lib/auth";

// Entry gate. While tokens hydrate we show a spinner; a session or an active
// guest lands in the (app) tab group, and everyone else meets /welcome — which
// offers using the app without an account before it offers signing in.
export default function Home() {
  const { user, guest, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user || guest) router.replace("/(app)");
    else router.replace("/welcome");
  }, [loading, user, guest]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator />
    </View>
  );
}
