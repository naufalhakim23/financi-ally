import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from "react-native";
import { router } from "expo-router";

import { Field, PrimaryButton } from "../src/components/forms";
import { useAuth } from "../src/lib/auth";
import { messageFor } from "../src/lib/errors";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      // base_currency is optional — omit when blank so the server default (IDR) applies.
      await register(email.trim(), password, baseCurrency.trim() || undefined);
    } catch (e) {
      setError(messageFor(e, "Registration failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-3xl font-bold text-center mb-1">FinanciAlly</Text>
        <Text className="text-center text-gray-500 mb-8">Create your account</Text>

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

        {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}

        <PrimaryButton label="Create account" onPress={submit} busy={busy} />

        <Pressable onPress={() => router.push("/login")} className="mt-6 self-center">
          <Text className="text-gray-600">
            Already have an account? <Text className="text-blue-600 font-semibold">Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
