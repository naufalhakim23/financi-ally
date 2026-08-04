import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen, FormError, OrDivider } from "../src/components/auth-screen";
import { useGuestMerge } from "../src/components/guest-merge";
import { Button, Chip, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";
import { messageFor } from "../src/lib/errors";
import { guestCurrency, isGuest } from "../src/lib/guestStore";
import { syncDatabase } from "../src/lib/sync";
import { currencyError, emailError, passwordError, MIN_PASSWORD } from "../src/lib/validate";

// Same shortcut set welcome offers. The field stays authoritative so any ISO
// code works; the chips are just the common answers made one tap away.
const COMMON = ["IDR", "USD", "EUR", "SGD"];

export default function RegisterScreen() {
  const { register, googleSignin, googleEnabled } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // A guest already picked a currency and has entries denominated in it; the
  // new account must inherit it, or every figure silently reprices.
  const inherited = guestCurrency();
  const [baseCurrency, setBaseCurrency] = useState(inherited ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const { afterSignIn, dialog } = useGuestMerge();

  const emailErr = emailError(email);
  const passwordErr = passwordError(password);
  const currencyErr = currencyError(baseCurrency, { required: false });
  const invalid = emailErr ?? passwordErr ?? currencyErr;

  const code = baseCurrency.trim().toUpperCase();

  async function submit() {
    setShowFieldErrors(true);
    if (invalid) return;
    setError(null);
    setBusy(true);
    try {
      // base_currency is optional; omit when blank so the server default (IDR) applies.
      await register(email.trim(), password, code || undefined);
      // Anything entered as a guest is still WatermelonDB `created`, so this
      // first cycle carries the whole history up. Failure is not fatal — the
      // rows stay pending and the next sync retries.
      await syncDatabase().catch(() => {});
      router.replace("/(app)/setup");
    } catch (e) {
      setError(messageFor(e, "Registration failed"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Signing up with Google is the same call as signing in with it — the server
   * find-or-creates. Offering it only on the sign-in screen made the shorter
   * path invisible to exactly the people who needed it: new users.
   *
   * Because it find-or-creates, this frequently lands in an account that
   * already has entries, so it goes through the same merge gate as login.
   */
  async function google() {
    setError(null);
    setBusy(true);
    const wasGuest = isGuest();
    try {
      await googleSignin();
      await afterSignIn(wasGuest);
    } catch (e) {
      setError(messageFor(e, "Google sign-up failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen caption="Create your account" onBack={() => router.replace("/welcome")}>
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
        placeholder={`At least ${MIN_PASSWORD} characters`}
        helper={`${MIN_PASSWORD} characters minimum`}
        secure
        autoCap="none"
        // new-password is what tells a password manager to *offer to generate*
        // one rather than autofill an existing credential.
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmit={submit}
        error={showFieldErrors ? passwordErr : null}
      />

      <Field
        label="Base currency"
        value={baseCurrency}
        onChange={setBaseCurrency}
        placeholder="IDR"
        helper={
          inherited
            ? `Carried over from what you've already recorded on this device`
            : "Everything is reported in this currency. Leave blank for IDR."
        }
        autoCap="characters"
        maxLength={3}
        error={showFieldErrors ? currencyErr : null}
      />
      <View className="flex-row flex-wrap -mt-2 mb-4" style={{ gap: 8 }}>
        {COMMON.map((c) => (
          <Chip key={c} label={c} active={code === c} onPress={() => setBaseCurrency(c)} />
        ))}
      </View>

      <FormError message={error} />

      <Button label="Create account" onPress={submit} busy={busy} />

      {googleEnabled && (
        <>
          <OrDivider />
          <Button
            label="Continue with Google"
            onPress={google}
            variant="secondary"
            disabled={busy}
          />
          <Text className="text-caption font-sans-medium text-faint text-center mt-2">
            Google accounts skip the password. You can add one later from Forgot password.
          </Text>
        </>
      )}

      <View className="mt-6 self-center">
        <Button
          label="Already have an account? Sign in"
          variant="tertiary"
          onPress={() => router.replace("/login")}
        />
      </View>

      {dialog}
    </AuthScreen>
  );
}
