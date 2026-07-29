import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from "react-native";
import { router } from "expo-router";

import { Field, PrimaryButton, SecondaryButton } from "../src/components/forms";
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
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-3xl font-bold text-center mb-1">FinanciAlly</Text>
        <Text className="text-center text-gray-500 mb-8">Sign in to your account</Text>

        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCap="none"
        />
        <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••" secure />

        {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}

        <PrimaryButton label="Sign in" onPress={submit} busy={busy} />

        {googleEnabled && (
          <>
            <Text className="text-center text-gray-400 my-4">or</Text>
            <SecondaryButton label="Continue with Google" onPress={google} busy={busy} />
          </>
        )}

        <Pressable onPress={() => router.replace("/register")} className="mt-6 self-center">
          <Text className="text-gray-600">
            No account? <Text className="text-blue-600 font-semibold">Register</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
