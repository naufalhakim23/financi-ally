import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { AuthScreen, FormError } from "../src/components/auth-screen";
import { Button, Chip, Field } from "../src/components/ui";
import { useAuth } from "../src/lib/auth";
import { messageFor } from "../src/lib/errors";
import { currencyError } from "../src/lib/validate";
import { useStrings } from "../src/lib/wording";

// Common bases, not an exhaustive list — the field below stays authoritative so
// any ISO code works. Chips are shortcuts, not the choice itself.
const COMMON = ["IDR", "USD", "EUR", "SGD"];

// First run. Using the app without an account is the primary path: everything
// that records money is local-first already, so an account buys sync, sharing
// and the server-computed screens — not the ability to start.
//
// One primary button, and it is the no-account one: this screen exists to get
// someone recording money in a single tap, not to sell them a sign-up.
export default function WelcomeScreen() {
  const { startGuest } = useAuth();
  const s = useStrings();
  const [currency, setCurrency] = useState("IDR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = currency.trim().toUpperCase();
  const currencyErr = currencyError(currency, { required: true });

  async function begin() {
    if (currencyErr) return;
    setError(null);
    setBusy(true);
    try {
      await startGuest(code);
      // Straight into setup — the currency question this screen just asked was
      // the wizard's missing first step.
      router.replace("/(app)/setup");
    } catch (e) {
      setError(messageFor(e, s.auth.welcome.failed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      caption={s.auth.welcome.caption}
      footer={
        <Text className="text-caption font-sans-medium text-faint text-center">
          {s.auth.welcome.footer}
        </Text>
      }
    >
      <Field
        label={s.auth.welcome.currencyLabel}
        value={currency}
        onChange={setCurrency}
        placeholder="IDR"
        autoCap="characters"
        maxLength={3}
        // No submit-on-return: the chips below are the intended path, and the
        // primary button is one tap away.
        error={currency.length >= 3 ? currencyErr : null}
      />
      <View className="flex-row flex-wrap mb-6" style={{ gap: 8 }}>
        {COMMON.map((c) => (
          <Chip key={c} label={c} active={code === c} onPress={() => setCurrency(c)} />
        ))}
      </View>

      <FormError message={error} />

      <Button
        label={s.auth.welcome.start}
        onPress={begin}
        busy={busy}
        disabled={!!currencyErr}
      />

      <View className="mt-4" style={{ gap: 4 }}>
        <Button
          label={s.auth.welcome.haveAccount}
          variant="secondary"
          onPress={() => router.push("/login")}
        />
      </View>
    </AuthScreen>
  );
}
