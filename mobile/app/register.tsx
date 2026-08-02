import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Button, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";
import { messageFor } from "../src/lib/errors";
import { guestCurrency } from "../src/lib/guestStore";
import { syncDatabase } from "../src/lib/sync";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // A guest already picked a currency and has entries denominated in it; the
  // new account must inherit it, or every figure silently reprices.
  const [baseCurrency, setBaseCurrency] = useState(guestCurrency() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      // base_currency is optional; omit when blank so the server default (IDR) applies.
      await register(email.trim(), password, baseCurrency.trim() || undefined);
      // Anything entered as a guest is still WatermelonDB `created`, so this
      // first cycle carries the whole history up. Failure is not fatal — the
      // rows stay pending and the next sync retries.
      await syncDatabase().catch(() => {});
      router.replace("/(app)");
    } catch (e) {
      setError(messageFor(e, "Registration failed"));
    } finally {
      setBusy(false);
    }
  }

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
        <Text className="text-body font-sans-medium text-dim text-center mb-8">Create your account</Text>

        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCap="none"
        />
        <Field label="Password" value={password} onChange={setPassword} placeholder="at least 8 characters" secure />
        <Field
          label="Base currency (optional)"
          value={baseCurrency}
          onChange={setBaseCurrency}
          placeholder="IDR"
          autoCap="characters"
        />

        {error && (
          <Text className="text-error text-caption font-sans-medium mb-3">{error}</Text>
        )}

        <Button label="Create account" onPress={submit} busy={busy} />

        <View className="mt-6 self-center">
          <Button
            label="Already have an account? Sign in"
            variant="tertiary"
            onPress={() => router.replace("/login")}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
