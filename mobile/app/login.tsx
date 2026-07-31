import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Button, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";
import { messageFor } from "../src/lib/errors";

export default function LoginScreen() {
  const { login, googleSignin, googleEnabled } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/(app)");
    } catch (e) {
      setError(messageFor(e, "Sign in failed"));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    setBusy(true);
    try {
      await googleSignin();
      router.replace("/(app)");
    } catch (e) {
      setError(messageFor(e, "Google sign-in failed"));
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
        <Text className="text-body font-sans-medium text-dim text-center mb-8">Sign in to your account</Text>

        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCap="none"
        />
        <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••" secure />

        {error && (
          <Text className="text-error text-caption font-sans-medium mb-3">{error}</Text>
        )}

        <Button label="Sign in" onPress={submit} busy={busy} />

        {googleEnabled && (
          <>
            <Text className="text-caption font-sans-medium text-faint text-center my-4">or</Text>
            <Button
              label="Continue with Google"
              onPress={google}
              variant="secondary"
              busy={busy}
            />
          </>
        )}

        <View className="mt-6 self-center">
          <Button
            label="No account? Register"
            variant="tertiary"
            onPress={() => router.replace("/register")}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
