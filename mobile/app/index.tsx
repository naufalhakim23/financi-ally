import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { useAuth } from "../src/lib/auth";

// Home — M1 gate. While tokens hydrate we show a spinner; with no session we
// redirect to /login; signed in we show the account summary + sign out. The
// real dashboard (net worth, budget, recent) lands in M3.
export default function Home() {
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user]);

  if (loading || !user) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <Text className="text-2xl font-bold mb-1">Signed in</Text>
      <Text className="text-gray-500 mb-6">M1 — auth. Dashboard arrives in M3.</Text>

      <View className="border border-gray-200 rounded-xl p-5 mb-8">
        <Row label="Email" value={user.email} />
        <Row label="Base currency" value={user.base_currency} />
        <Row label="User ID" value={user.id} />
      </View>

      <Pressable
        onPress={logout}
        className="border border-red-300 rounded-lg py-4 items-center"
      >
        <Text className="text-red-600 font-semibold">Sign out</Text>
      </Pressable>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2">
      <Text className="text-gray-500">{label}</Text>
      <Text className="font-medium text-right" style={{ maxWidth: 220 }}>
        {value}
      </Text>
    </View>
  );
}
