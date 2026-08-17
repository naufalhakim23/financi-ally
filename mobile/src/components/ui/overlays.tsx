import { useEffect } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "./core";
import { haptic } from "./haptics";
import { useTheme } from "./tokens";

// ─── Overlays (DESIGN.md v1.0 → Bottom sheets & dialogs) ────────────────────
// Sheets and the FAB are the only elements that genuinely float.

/**
 * Bottom sheet. Carries the grab handle, the scrim, and its own scrolling so
 * callers only supply content. Tapping the scrim dismisses — destructive
 * confirmations belong in a Dialog, which does not.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { C, ELEVATION } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: C.scrim }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          className="bg-surface rounded-t-2xl pb-10"
          style={[{ maxHeight: "85%" }, ELEVATION.float]}
        >
          <View className="items-center py-2.5">
            <View className="h-1 w-9 rounded-full bg-outline-strong" />
          </View>
          {title && (
            <View className="flex-row items-center justify-between px-4 pb-2">
              <Text className="text-headline font-sans-bold text-ink">{title}</Text>
              <Button label="Cancel" onPress={onClose} variant="tertiary" fullWidth={false} />
            </View>
          )}
          <ScrollView
            className="px-4"
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Confirmation dialog for irreversible actions. The destructive button trails,
 * so the safe choice sits under the thumb's resting position.
 */
export function Dialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  busy = false,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  /** Name the safe outcome when "Cancel" is not what declining actually means. */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { C, ELEVATION } = useTheme();
  useEffect(() => {
    if (visible) haptic.warn();
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: C.scrim }}
      >
        <View
          className="w-full bg-surface rounded-2xl p-6"
          style={ELEVATION.float}
          accessibilityViewIsModal
        >
          <Text className="text-headline font-sans-bold text-ink">{title}</Text>
          {body && <Text className="text-body font-sans-medium text-dim mt-2">{body}</Text>}
          <View className="flex-row mt-6" style={{ gap: 12 }}>
            <View className="flex-1">
              <Button label={cancelLabel} onPress={onCancel} variant="secondary" disabled={busy} />
            </View>
            <View className="flex-1">
              <Button
                label={confirmLabel}
                onPress={onConfirm}
                variant="destructive"
                busy={busy}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
