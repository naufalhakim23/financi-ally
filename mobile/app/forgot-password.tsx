import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AuthScreen, FormError } from "../src/components/auth-screen";
import { Button, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";
import { messageFor } from "../src/lib/errors";
import { emailError } from "../src/lib/validate";

// Step 1 of 2. Step 2 is /reset-password, which takes the emailed code.
export default function ForgotPasswordScreen() {
  const { forgotPassword } = useAuth();
  // Prefilled from the sign-in screen when something was already typed there.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const emailErr = emailError(email);

  async function submit() {
    setShowFieldErrors(true);
    if (emailErr) return;
    setError(null);
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      // The server answers 204 whether or not the address is registered, so
      // this screen must not imply an account exists — it moves on either way.
      router.replace({ pathname: "/reset-password", params: { email: email.trim() } });
    } catch (e) {
      setError(messageFor(e, "Couldn't send the code"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen caption="Reset your password" onBack={() => router.replace("/login")}>
      <Text className="text-caption font-sans-semibold text-faint uppercase text-center mb-4">
        step 1 of 2
      </Text>

      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        helper="We'll send a 6-digit code to this address"
        keyboardType="email-address"
        autoCap="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmit={submit}
        autoFocus={!params.email}
        error={showFieldErrors ? emailErr : null}
      />

      <FormError message={error} />

      <Button label="Send the code" onPress={submit} busy={busy} />

      <View className="mt-6 self-center">
        <Button
          label="I already have a code"
          variant="tertiary"
          onPress={() =>
            router.replace({ pathname: "/reset-password", params: { email: email.trim() } })
          }
        />
      </View>
    </AuthScreen>
  );
}
