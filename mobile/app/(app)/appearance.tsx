import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import {
  Amount,
  Card,
  ScreenHeader,
  SectionLabel,
  SegmentedControl,
  useTheme,
} from "../../src/components/ui";
import { setThemePreference, useThemePreference, type ThemePreference } from "../../src/lib/theme";
import { useStrings } from "../../src/lib/wording";

// Light / dark / follow the phone. The preview is the point: both palettes are
// shown side by side so the choice is made by looking, not by guessing what
// "dark" does to a screen full of money.
export default function AppearanceScreen() {
  const preference = useThemePreference();
  const s = useStrings();
  const { dark } = useTheme();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title={s.settings.appearance.title}
        backLabel={s.settings.appearance.backLabel}
        backAccessibilityLabel={s.common.backTo(s.settings.appearance.backLabel)}
        onBack={() => router.back()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <SegmentedControl
          value={preference}
          onChange={(v) => setThemePreference(v as ThemePreference)}
          options={[
            { value: "system", label: s.settings.appearance.system },
            { value: "light", label: s.settings.appearance.light },
            { value: "dark", label: s.settings.appearance.dark },
          ]}
        />
        <Text className="text-caption font-sans-medium text-dim">
          {preference === "system"
            ? s.settings.appearance.followingPhone(
                dark ? s.settings.appearance.currentDark : s.settings.appearance.currentLight,
              )
            : s.settings.appearance.alwaysSet(preference)}
        </Text>

        <SectionLabel>{s.settings.appearance.preview}</SectionLabel>
        <Card>
          <SectionLabel>{s.settings.appearance.previewTotal}</SectionLabel>
          <Text className="text-amount-hero font-mono-bold text-ink mt-2">12,480,000</Text>
          <View className="flex-row items-center justify-between mt-3.5">
            <Text className="text-body-strong font-sans-semibold text-ink">
              {s.settings.appearance.previewGroceries}
            </Text>
            <Amount minor={-24500000} currency="IDR" size="md" />
          </View>
          <View className="h-px bg-outline-variant my-3" />
          <View className="flex-row items-center justify-between">
            <Text className="text-body-strong font-sans-semibold text-ink">
              {s.settings.appearance.previewSalary}
            </Text>
            <Amount minor={950000000} currency="IDR" size="md" />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
