import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Check, X } from "lucide-react-native";

import { Button, Card, ICON, ProgressBar, SectionLabel, useTheme } from "./ui";
import { useStrings } from "../lib/wording";
import { useSetupState, type SetupItem } from "../lib/setup";
import { Account, Entry, JournalLine } from "../model/models";

// The safety net under a skippable wizard. Rows are derived from the local
// tables, so each one ticks the moment the thing exists — whether it was
// created here, in the wizard, or on the web.

// Categories and income sources have no dedicated create screen on this client;
// the wizard is where they come from, and re-running it skips what already
// exists.
const GO_TO: Record<SetupItem["key"], () => void> = {
  pocket: () => router.push("/(app)/pocket-new"),
  category: () => router.push("/(app)/setup"),
  income: () => router.push("/(app)/setup"),
  entry: () => router.push("/(app)/entry-new"),
};

export function SetupChecklist({
  accounts,
  entries,
  lines,
}: {
  accounts: Account[];
  entries: Entry[];
  lines: JournalLine[];
}) {
  const { C } = useTheme();
  const s = useStrings();
  const { items, done, complete, dismissed, dismiss } = useSetupState(accounts, entries, lines);

  if (complete || dismissed) return null;

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <SectionLabel>{s.setup.checklist.title}</SectionLabel>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={s.setup.checklist.dismiss}
          hitSlop={12}
        >
          <X size={ICON.md} color={C.dim} strokeWidth={2} />
        </Pressable>
      </View>

      <View className="flex-row items-center mt-2.5" style={{ gap: 10 }}>
        <View className="flex-1">
          {/* Neutral, not the spend ramp: finishing setup is progress, so a bar
              that turned red on the last step would read as a failure. */}
          <ProgressBar pct={(done / items.length) * 100} tone="neutral" />
        </View>
        <Text className="text-mono-meta font-mono text-faint">
          {s.setup.checklist.progress(done, items.length)}
        </Text>
      </View>

      <View className="mt-1.5">
        {items.map((item) => (
          <View key={item.key} className="flex-row items-center py-2" style={{ gap: 10 }}>
            <View
              className={`w-5 h-5 rounded-full items-center justify-center border ${
                item.done ? "bg-success border-success" : "border-outline"
              }`}
            >
              {item.done && <Check size={ICON.xs} color={C.onPrimary} strokeWidth={3} />}
            </View>
            <View className="flex-1">
              <Text
                className={`text-body font-sans-medium ${item.done ? "text-dim" : "text-ink"}`}
                numberOfLines={1}
              >
                {s.setup.checklist.items[item.key].label}
              </Text>
              <Text className="text-caption font-sans-medium text-faint" numberOfLines={1}>
                {s.setup.checklist.items[item.key].hint}
              </Text>
            </View>
            {!item.done && (
              <Button
                label={s.setup.checklist.add}
                variant="tertiary"
                fullWidth={false}
                onPress={GO_TO[item.key]}
              />
            )}
          </View>
        ))}
      </View>
    </Card>
  );
}
