import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Home, LayoutGrid, LineChart, MoreHorizontal, Plus } from "lucide-react-native";

import { TERM_ROWS, term, useStrings, useWording, type Wording } from "../../src/lib/wording";
import {
  Card,
  ScreenHeader,
  SectionLabel,
  SegmentedControl,
  SwitchRow,
  ICON,
  useTheme,
} from "../../src/components/ui";

// One switch renames the whole app between plain and ledger vocabulary. The
// mapping table is the teaching moment; the tab-bar preview shows the blast
// radius before the change lands.
export default function WordingScreen() {
  const { mode, setMode, showSides, setShowSides } = useWording();
  const s = useStrings();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title={s.settings.wording.title}
        backLabel={s.settings.wording.backLabel}
        onBack={() => router.back()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <SegmentedControl
          value={mode}
          onChange={(m) => setMode(m as Wording)}
          options={[
            { value: "normal", label: s.settings.wording.normalLabel },
            { value: "finance", label: s.settings.wording.financeLabel },
          ]}
        />
        <Text className="text-caption font-sans-medium text-dim">
          {s.settings.wording.explainer}
        </Text>

        <Card padded={false}>
          <View className="flex-row bg-surface-container px-4 py-2.5" style={{ gap: 12 }}>
            <Text className="flex-1 text-overline font-sans-semibold text-faint uppercase">
              {s.settings.wording.columnNormal}
            </Text>
            <Text className="flex-1 text-overline font-sans-semibold text-faint uppercase">
              {s.settings.wording.columnFinance}
            </Text>
          </View>
          {TERM_ROWS.map((row) => (
            <View
              key={row.key}
              className="flex-row border-t border-outline-variant px-4 py-3"
              style={{ gap: 12 }}
            >
              <Text
                className={`flex-1 text-body font-sans-medium ${
                  mode === "normal" ? "text-ink" : "text-dim"
                }`}
              >
                {row.normal}
              </Text>
              <Text
                className={`flex-1 text-body font-sans-medium ${
                  mode === "finance" ? "text-ink" : "text-dim"
                }`}
              >
                {row.finance}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <SwitchRow
            label={s.settings.wording.showSides}
            helper={s.settings.wording.showSidesHelper}
            value={showSides}
            onChange={setShowSides}
          />
        </Card>

        <Card>
          <SectionLabel>{s.settings.wording.preview}</SectionLabel>
          <View className="mt-3.5">
            <TabPreview mode="normal" active={mode === "normal"} />
            <View className="h-px bg-outline-variant my-3.5" />
            <TabPreview mode="finance" active={mode === "finance"} />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const PREVIEW_GLYPHS = [Home, LineChart, LayoutGrid, MoreHorizontal];

function TabPreview({ mode, active }: { mode: Wording; active: boolean }) {
  const { C } = useTheme();
  const s = useStrings();
  // Terms read for the row's own mode, not the active one: both rows show at once.
  const labels = [s.common.home, term("history", mode), term("buckets", mode), s.more.title];
  const color = active ? C.ink : C.faint;

  return (
    <View className="flex-row items-center">
      {labels.slice(0, 2).map((label, i) => (
        <PreviewSlot key={label} glyph={PREVIEW_GLYPHS[i]} label={label} color={color} />
      ))}
      <View className="flex-1 items-center">
        <Plus size={ICON.md} color={C.faint} strokeWidth={1.75} />
      </View>
      {labels.slice(2).map((label, i) => (
        <PreviewSlot key={label} glyph={PREVIEW_GLYPHS[i + 2]} label={label} color={color} />
      ))}
    </View>
  );
}

function PreviewSlot({
  glyph: G,
  label,
  color,
}: {
  glyph: typeof Home;
  label: string;
  color: string;
}) {
  return (
    <View className="flex-1 items-center">
      <G size={ICON.md} color={color} strokeWidth={1.75} />
      <Text className="text-overline font-sans-semibold mt-1" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
