import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen, FormError, OrDivider } from "../src/components/auth-screen";
import { useGuestMerge } from "../src/components/guest-merge";
import { Button, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";
import { messageFor } from "../src/lib/errors";
import { isGuest } from "../src/lib/guestStore";
import { emailError } from "../src/lib/validate";

export default function LoginScreen() {
  const { login, googleSignin, googleEnabled } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Field errors appear only after a submit attempt: flagging an address as
  // malformed while it is still being typed is noise, not help.
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const { afterSignIn, dialog } = useGuestMerge(email.trim());

  const emailErr = emailError(email);
  // Length isn't checked here: an existing account may predate the current
  // minimum, and telling someone their real password is "too short" at the
  // sign-in door is a dead end.
  const passwordErr = password ? null : "Enter your password";
  const invalid = emailErr ?? passwordErr;

  async function submit() {
    setShowFieldErrors(true);
    if (invalid) return;
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
    <AuthScreen caption="Sign in to your account" onBack={() => router.replace("/welcome")}>
      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCap="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmit={() => passwordRef.current?.focus()}
        error={showFieldErrors ? emailErr : null}
      />
      <Field
        ref={passwordRef}
        label="Password"
        value={password}
        onChange={setPassword}
        placeholder="Your password"
        secure
        autoCap="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmit={submit}
        error={showFieldErrors ? passwordErr : null}
      />

      <View className="self-end -mt-2 mb-3">
        <Button
          label="Forgot password?"
          variant="tertiary"
          onPress={() =>
            // Carry whatever was typed so the next screen doesn't ask again.
            router.push({ pathname: "/forgot-password", params: { email: email.trim() } })
          }
        />
      </View>

      <FormError message={error} />

      <Button label="Sign in" onPress={submit} busy={busy} />

      {googleEnabled && (
        <>
          <OrDivider />
          <Button
            label="Continue with Google"
            onPress={google}
            variant="secondary"
            disabled={busy}
          />
        </>
      )}

      <View className="mt-6 self-center">
        <Button
          label="No account? Create one"
          variant="tertiary"
          onPress={() => router.replace("/register")}
        />
      </View>

      {dialog}
    </AuthScreen>
  );
}
