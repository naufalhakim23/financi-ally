import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Plus } from "lucide-react-native";

import { usePressed } from "./core";
import { useTheme, type Glyph } from "./tokens";

// ─── Navigation chrome (direction 2a) ───────────────────────────────────────
// Five slots with the centre add affordance breaking the top edge. The FAB is
// not a tab — it pushes the add sheet — so the bar is built from an explicit
// slot list rather than from the navigator's descriptors.

export type TabSlot = { name: string; label: string; glyph: Glyph };

export function TabBar({
  slots,
  activeName,
  onSelect,
  onAdd,
  addLabel = "Add entry",
}: {
  /** Exactly four: two left of the FAB, two right. */
  slots: TabSlot[];
  activeName: string;
  onSelect: (name: string) => void;
  onAdd: () => void;
  addLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const left = slots.slice(0, 2);
  const right = slots.slice(2, 4);

  return (
    <View
      className="flex-row items-end bg-surface border-t border-outline px-2 pt-2.5"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {left.map((s) => (
        <TabItem key={s.name} slot={s} active={s.name === activeName} onPress={() => onSelect(s.name)} />
      ))}

      {/* The FAB overhangs the bar's top edge; the slot keeps its width so the
          four labels stay evenly spaced. */}
      <View className="flex-1 items-center">
        <Fab onPress={onAdd} label={addLabel} />
      </View>

      {right.map((s) => (
        <TabItem key={s.name} slot={s} active={s.name === activeName} onPress={() => onSelect(s.name)} />
      ))}
    </View>
  );
}

function TabItem({ slot, active, onPress }: { slot: TabSlot; active: boolean; onPress: () => void }) {
  const { C } = useTheme();
  const { glyph: G, label } = slot;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      className="flex-1 items-center min-h-touch justify-end"
    >
      <G size={22} color={active ? C.primary : C.faint} strokeWidth={active ? 2 : 1.75} />
      <Text
        className={`text-overline font-sans-semibold mt-1 ${active ? "text-primary" : "text-faint"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  const { C, ELEVATION } = useTheme();
  const { pressed, handlers } = usePressed();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...handlers}
      className={`w-14 h-14 rounded-full items-center justify-center ${
        pressed ? "bg-primary-pressed" : "bg-primary"
      }`}
      style={[{ marginTop: -28 }, ELEVATION.float]}
    >
      <Plus size={24} color={C.onPrimary} strokeWidth={1.75} />
    </Pressable>
  );
}

/**
 * Detail-screen header: a back affordance that names where it returns to, the
 * title, and one optional action. Both sides reserve the same width so the
 * title stays optically centred whatever the labels say.
 */
export function ScreenHeader({
  title,
  backLabel,
  onBack,
  actionLabel,
  onAction,
}: {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { C } = useTheme();
  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-3" style={{ gap: 8 }}>
      <View className="flex-1 items-start">
        {onBack && (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={backLabel ? `Back to ${backLabel}` : "Back"}
            className="flex-row items-center min-h-touch"
          >
            <ChevronLeft size={18} color={C.info} strokeWidth={2} />
            {backLabel && (
              <Text className="text-body-strong font-sans-semibold text-info ml-0.5">{backLabel}</Text>
            )}
          </Pressable>
        )}
      </View>

      <Text className="text-headline font-sans-semibold text-ink" numberOfLines={1}>
        {title}
      </Text>

      <View className="flex-1 items-end">
        {actionLabel && onAction && (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            className="min-h-touch justify-center"
          >
            <Text className="text-body-strong font-sans-semibold text-info">{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * List-screen header: large title on the left, actions on the right. Used where
 * a screen is a top-level destination rather than a pushed detail.
 */
export function TitleBar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
      <Text className="text-title font-sans-bold text-ink">{title}</Text>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {children}
      </View>
    </View>
  );
}

/** 40px circular surface button used for search / filter in a TitleBar. */
export function IconButton({
  glyph: G,
  label,
  onPress,
}: {
  glyph: Glyph;
  label: string;
  onPress: () => void;
}) {
  const { C, ELEVATION } = useTheme();
  const { pressed, handlers } = usePressed();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...handlers}
      className={`w-10 h-10 rounded-xl items-center justify-center ${
        pressed ? "bg-surface-pressed" : "bg-surface"
      }`}
      style={ELEVATION.card}
    >
      <G size={20} color={C.dim} strokeWidth={1.75} />
    </Pressable>
  );
}
