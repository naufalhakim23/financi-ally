import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen, backToWelcome, FormError, OrDivider } from "../src/components/auth-screen";
import { useGuestMerge } from "../src/components/guest-merge";
import { Button, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";
import { messageFor } from "../src/lib/errors";
import { isGuest } from "../src/lib/guestStore";
import { emailError } from "../src/lib/validate";
import { useStrings } from "../src/lib/wording";

export default function LoginScreen() {
  const { login, googleSignin, googleEnabled } = useAuth();
  const s = useStrings();
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
  const passwordErr = password ? null : s.auth.login.noPassword;
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
      setError(messageFor(e, s.auth.login.failed));
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
      setError(messageFor(e, s.auth.login.googleFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen caption={s.auth.login.caption} onBack={backToWelcome}>
      <Field
        label={s.auth.emailLabel}
        value={email}
        onChange={setEmail}
        placeholder={s.auth.emailPlaceholder}
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
        label={s.auth.login.passwordLabel}
        value={password}
        onChange={setPassword}
        placeholder={s.auth.login.passwordPlaceholder}
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
          label={s.auth.login.forgot}
          variant="tertiary"
          onPress={() =>
            // Carry whatever was typed so the next screen doesn't ask again.
            router.push({ pathname: "/forgot-password", params: { email: email.trim() } })
          }
        />
      </View>

      <FormError message={error} />

      <Button label={s.auth.login.submit} onPress={submit} busy={busy} />

      {googleEnabled && (
        <>
          <OrDivider />
          <Button
            label={s.auth.login.google}
            onPress={google}
            variant="secondary"
            disabled={busy}
          />
        </>
      )}

      <View className="mt-6 self-center">
        <Button
          label={s.auth.login.toRegister}
          variant="tertiary"
          onPress={() => router.replace("/register")}
        />
      </View>

      {dialog}
    </AuthScreen>
  );
}
