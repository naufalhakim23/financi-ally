import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Button, Dialog, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";
import { database } from "../src/lib/db";
import { messageFor } from "../src/lib/errors";
import { isGuest } from "../src/lib/guestStore";
import { markLedgerStale } from "../src/lib/ledgerStore";
import { syncDatabase } from "../src/lib/sync";

export default function LoginScreen() {
  const { login, googleSignin, googleEnabled } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // >0 means a guest with local entries just signed into an existing account,
  // and we're holding on the merge question before leaving this screen.
  const [guestEntries, setGuestEntries] = useState(0);

  /**
   * Runs after a session is established. A guest who signed in has entries on
   * this device that belong to nobody yet; pushing them into an account that
   * already has its own is a decision only the user can make, so ask before
   * anything reaches the server.
   */
  async function afterSignIn(wasGuest: boolean) {
    if (wasGuest) {
      const n = await database.get("entries").query().fetchCount();
      if (n > 0) {
        setGuestEntries(n);
        return; // the dialog finishes the navigation
      }
    }
    await syncDatabase().catch(() => {});
    router.replace("/(app)");
  }

  /** Keep the device's entries: they push into the account on this cycle. */
  async function keepLocal() {
    setGuestEntries(0);
    await syncDatabase().catch(() => {});
    router.replace("/(app)");
  }

  /**
   * Discard them. The stale flag is the existing mechanism for "this local
   * database belongs to a book we can no longer read" — it wipes before the
   * pull, which is exactly what starting fresh means here.
   */
  async function discardLocal() {
    markLedgerStale();
    setGuestEntries(0);
    await syncDatabase().catch(() => {});
    router.replace("/(app)");
  }

  async function submit() {
    setError(null);
    setBusy(true);
    const wasGuest = isGuest();
    try {
      await login(email.trim(), password);
      await afterSignIn(wasGuest);
    } catch (e) {
      setError(messageFor(e, "Sign in failed"));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    setBusy(true);
    const wasGuest = isGuest();
    try {
      await googleSignin();
      await afterSignIn(wasGuest);
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

      <Dialog
        visible={guestEntries > 0}
        title="Entries on this device"
        body={`You recorded ${guestEntries} ${guestEntries === 1 ? "entry" : "entries"} without an account. Keep them and they move into ${email.trim() || "your account"}.`}
        cancelLabel="Keep them"
        confirmLabel="Start fresh"
        onCancel={keepLocal}
        onConfirm={discardLocal}
      />
    </KeyboardAvoidingView>
  );
}
