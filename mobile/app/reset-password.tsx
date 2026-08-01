import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AuthScreen, FormError } from "../src/components/auth-screen";
import { useGuestMerge } from "../src/components/guest-merge";
import { Button, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";
import { messageFor } from "../src/lib/errors";
import { isGuest } from "../src/lib/guestStore";
import { emailError, passwordError, resetCodeError, MIN_PASSWORD } from "../src/lib/validate";

// Step 2 of 2. The server signs the user in on success, so this screen lands
// straight in the app rather than bouncing back through /login.
export default function ResetPasswordScreen() {
  const { forgotPassword, resetPassword } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  // A reset signs the caller into an existing account, so it owes the same
  // merge question login asks.
  const { afterSignIn, dialog } = useGuestMerge(email.trim());

  const emailErr = emailError(email);
  const codeErr = resetCodeError(code);
  const passwordErr = passwordError(password);
  const invalid = emailErr ?? codeErr ?? passwordErr;

  async function submit() {
    setShowFieldErrors(true);
    if (invalid) return;
    setError(null);
    setBusy(true);
    const wasGuest = isGuest();
    try {
      await resetPassword(email.trim(), code.trim(), password);
      await afterSignIn(wasGuest);
    } catch (e) {
      setError(messageFor(e, "Couldn't reset your password"));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (emailErr) {
      setShowFieldErrors(true);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      // Issuing a new code retires the previous one server-side, so say it.
      setCode("");
      setResent(true);
    } catch (e) {
      setError(messageFor(e, "Couldn't send a new code"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen caption="Enter your code" onBack={() => router.replace("/forgot-password")}>
      <Text className="text-caption font-sans-semibold text-faint uppercase text-center mb-4">
        step 2 of 2
      </Text>

      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCap="none"
        autoComplete="email"
        textContentType="emailAddress"
        error={showFieldErrors ? emailErr : null}
      />
      <Field
        label="Code"
        value={code}
        onChange={(v) => setCode(v.replace(/\D/g, ""))}
        placeholder="123456"
        helper={
          resent
            ? "A new code is on its way — the previous one no longer works"
            : "The 6-digit code we emailed you. It expires in 15 minutes."
        }
        keyboardType="number-pad"
        // one-time-code lets iOS/Android offer the code straight from the
        // notification, which is the whole reason this flow uses a code.
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        returnKeyType="next"
        onSubmit={() => passwordRef.current?.focus()}
        autoFocus
        error={showFieldErrors ? codeErr : null}
      />
      <Field
        ref={passwordRef}
        label="New password"
        value={password}
        onChange={setPassword}
        placeholder={`At least ${MIN_PASSWORD} characters`}
        secure
        autoCap="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmit={submit}
        error={showFieldErrors ? passwordErr : null}
      />

      <FormError message={error} />

      <Button label="Set new password" onPress={submit} busy={busy} />

      <View className="mt-4 self-center">
        <Button label="Send a new code" variant="tertiary" onPress={resend} disabled={busy} />
      </View>

      <Text className="text-caption font-sans-medium text-faint text-center mt-6">
        Setting a new password signs you out everywhere else.
      </Text>

      {dialog}
    </AuthScreen>
  );
}
