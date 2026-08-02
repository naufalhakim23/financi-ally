import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Button, Chip, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";

// Common bases, not an exhaustive list — the field below stays authoritative so
// any ISO code works. Chips are shortcuts, not the choice itself.
const COMMON = ["IDR", "USD", "EUR", "SGD"];

// First run. Using the app without an account is the primary path: everything
// that records money is local-first already, so an account buys sync, sharing
// and the server-computed screens — not the ability to start.
export default function WelcomeScreen() {
  const { startGuest } = useAuth();
  const [currency, setCurrency] = useState("IDR");
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    try {
      await startGuest(currency);
      router.replace("/(app)");
    } finally {
      setBusy(false);
    }
  }

  const code = currency.trim().toUpperCase();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-display font-sans-bold text-ink text-center mb-1">Financi-Ally</Text>
        <Text className="text-body font-sans-medium text-dim text-center mb-8">
          Track your money on this device. No account needed.
        </Text>

        <Field
          label="What currency do you count in?"
          value={currency}
          onChange={setCurrency}
          placeholder="IDR"
          autoCap="characters"
        />
        <View className="flex-row flex-wrap mb-6" style={{ gap: 8 }}>
          {COMMON.map((c) => (
            <Chip key={c} label={c} active={code === c} onPress={() => setCurrency(c)} />
          ))}
        </View>

        <Button label="Start tracking" onPress={begin} busy={busy} disabled={code.length < 3} />

        <View className="mt-6 self-center">
          <Button
            label="I already have an account"
            variant="tertiary"
            onPress={() => router.push("/login")}
          />
        </View>

        <Text className="text-caption font-sans-medium text-faint text-center mt-6">
          Everything stays on this device until you make an account. Create one later and what you
          have entered comes with you.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
