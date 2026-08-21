import * as Haptics from "expo-haptics";

// Fire-and-forget: a missing vibrator (web, simulator) must not break a tap.
function run(fn: () => Promise<void>) {
  fn().catch(() => {});
}

export type HapticKind = keyof typeof haptic;

export const haptic = {
  /** Selection tick: keypad keys, chips, tabs, segmented controls, pickers. */
  tap: () => run(() => Haptics.selectionAsync()),
  /** Soft thud: buttons and the FAB, a commitment rather than a browse. */
  tapLight: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** An entry posted, a form saved. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Validation refused, or a destructive dialog appeared. */
  warn: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** A save failed after the user committed. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
} as const;
