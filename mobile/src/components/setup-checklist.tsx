import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Check, X } from "lucide-react-native";

import { Button, Card, SectionLabel, useTheme } from "./ui";
import { useSetupState, type SetupItem } from "../lib/setup";
import { Account, Entry, JournalLine } from "../model/models";

// The safety net under a skippable wizard. Rows are derived from the local
// tables, so each one ticks the moment the thing exists — whether it was
// created here, in the wizard, or on the web.

// Categories and income sources have no dedicated create screen on this client;
// the wizard is where they come from, and re-running it skips what already
// exists.
const ACTION: Record<SetupItem["key"], { label: string; go: () => void }> = {
  pocket: { label: "Add", go: () => router.push("/(app)/pocket-new") },
  category: { label: "Add", go: () => router.push("/(app)/setup") },
  income: { label: "Add", go: () => router.push("/(app)/setup") },
  entry: { label: "Add", go: () => router.push("/(app)/entry-new") },
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
  const { items, done, complete, dismissed, dismiss } = useSetupState(accounts, entries, lines);

  if (complete || dismissed) return null;

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <SectionLabel>Finish setting up</SectionLabel>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss setup checklist"
          hitSlop={12}
        >
          <X size={16} color={C.dim} strokeWidth={2} />
        </Pressable>
      </View>

      <View className="flex-row items-center mt-2.5" style={{ gap: 10 }}>
        <View className="flex-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
          <View
            className="h-1.5 rounded-full bg-ink"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </View>
        <Text className="text-mono-meta font-mono text-faint">
          {done} of {items.length}
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
              {item.done && <Check size={12} color={C.onPrimary} strokeWidth={3} />}
            </View>
            <View className="flex-1">
              <Text
                className={`text-body font-sans-medium ${item.done ? "text-dim" : "text-ink"}`}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <Text className="text-caption font-sans-medium text-faint" numberOfLines={1}>
                {item.hint}
              </Text>
            </View>
            {!item.done && (
              <Button
                label={ACTION[item.key].label}
                variant="tertiary"
                fullWidth={false}
                onPress={ACTION[item.key].go}
              />
            )}
          </View>
        ))}
      </View>
    </Card>
  );
}
