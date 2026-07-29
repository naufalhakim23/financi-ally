import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";

import { useAuth } from "../src/lib/auth";

export default function Home() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(app)");
    else router.replace("/login");
  }, [loading, user]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator />
    </View>
  );
}
