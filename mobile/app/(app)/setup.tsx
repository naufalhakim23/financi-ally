import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { STARTER_STEPS, defaultSelection } from "@financially/domain/starter";

import { Button, Chip, SectionLabel } from "../../src/components/ui";
import { useAuth } from "../../src/lib/auth";
import { messageFor } from "../../src/lib/errors";
import { seedStarterAccounts } from "../../src/lib/setup";
import { useStrings } from "../../src/lib/wording";

// First-run setup, the same three steps and the same catalog as the web wizard.
// Every step is skippable; the Home checklist catches whoever bails.
//
// No currency step: welcome.tsx already asked a guest, registration asked
// everyone else, and there is no endpoint to change it afterwards.

export default function Setup() {
  const { baseCurrency } = useAuth();
  const s = useStrings();

  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(defaultSelection);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const current = STARTER_STEPS[step];
  const last = step === STARTER_STEPS.length - 1;

  function toggle(name: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }

  function leave() {
    // The wizard is pushed over the tabs on every path into it, so there is
    // always something behind it to go back to.
    router.replace("/(app)");
  }

  async function finish() {
    setErr(null);
    if (selection.size === 0) return leave();

    setBusy(true);
    try {
      await seedStarterAccounts(selection, baseCurrency);
      leave();
    } catch (e) {
      setErr(messageFor(e, s.setup.failed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          {STARTER_STEPS.map((stepDef, i) => (
            <View
              key={stepDef.key}
              className={`h-2 w-2 rounded-full ${i <= step ? "bg-ink" : "bg-outline-variant"}`}
            />
          ))}
          <Text className="text-caption font-sans-medium text-faint ml-2">
            {s.setup.step(step + 1, STARTER_STEPS.length)}
          </Text>
        </View>
        <Button label={s.common.skip} variant="tertiary" fullWidth={false} onPress={leave} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-headline font-sans-semibold text-ink">{current.title}</Text>
          <Text className="text-body font-sans text-dim mt-1">{current.hint}</Text>
        </View>

        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {current.items.map((item) => (
            <Chip
              key={item.name}
              label={item.type === "liability" ? s.setup.owedSuffix(item.name) : item.name}
              active={selection.has(item.name)}
              onPress={() => toggle(item.name)}
            />
          ))}
        </View>

        <SectionLabel>{s.setup.createdIn(baseCurrency)}</SectionLabel>

        {!!err && <Text className="text-caption font-sans-semibold text-error-strong">{err}</Text>}
      </ScrollView>

      <View className="flex-row px-4 pb-2" style={{ gap: 8 }}>
        {step > 0 && (
          <View className="flex-1">
            <Button
              label={s.common.back}
              variant="secondary"
              onPress={() => setStep((n) => n - 1)}
            />
          </View>
        )}
        <View className="flex-[2]">
          {last ? (
            <Button label={s.common.finish} onPress={finish} busy={busy} />
          ) : (
            <Button label={s.common.continue} onPress={() => setStep((n) => n + 1)} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
