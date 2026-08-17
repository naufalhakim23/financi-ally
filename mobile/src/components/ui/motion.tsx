import { useEffect, useRef } from "react";
import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { DURATION, EASING } from "./tokens";

// ─── Motion (DESIGN.md → Motion) ────────────────────────────────────────────
// Short, physical, never decorative. Reduced-motion keeps opacity and drops
// transform and width animation, so every primitive here takes that branch
// rather than leaving it to each caller to remember.

// DESIGN.md press-scale token. Discrete affordances only, not full-width rows —
// a whole row shrinking reads as the card flinching, and it is the exact path
// that costs the most on low-end Android.
export const PRESS_SCALE = 0.97;

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export { useReducedMotion };

/**
 * Cross-fade a figure when it changes. Never counts up: a balance ticking
 * through numbers it was never worth is a lie about money, however briefly.
 *
 * Called by headline figures only, never by `Amount` itself — a ledger screen
 * renders hundreds of those, and each one would allocate a shared value and an
 * effect to fade something nobody is watching. Same reason `usePressed` and
 * `usePressedScale` are two hooks rather than one.
 */
export function useValueFade(value: number) {
  const opacity = useSharedValue(1);
  const reduced = useReducedMotion();
  // A figure arriving on screen has not changed, it has appeared. Without this
  // the first commit fades too, so every mount of the screen (a tab switch, a
  // back-navigation) blinks the balance to nothing and back.
  const settled = useRef(false);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    const half = { duration: DURATION.fast / 2, easing: EASING.linear };
    opacity.value = withTiming(0, half, (done) => {
      "worklet";
      // An interrupted fade already has a successor running; scheduling the
      // fade back in would overwrite it and make rapid changes stutter.
      if (done) opacity.value = withTiming(1, half);
    });
  }, [value, opacity]);

  return useAnimatedStyle(() => ({ opacity: reduced ? 1 : opacity.value }));
}

/**
 * Animate a bar's fill to its new ratio. Width is a layout property, so
 * reduced-motion snaps it rather than easing it.
 */
export function useBarWidth(pct: number) {
  const clipped = Math.max(0, Math.min(pct, 100));
  const width = useSharedValue(clipped);
  const reduced = useReducedMotion();

  useEffect(() => {
    width.value = reduced
      ? clipped
      : withTiming(clipped, { duration: DURATION.base, easing: EASING.standard });
  }, [clipped, reduced, width]);

  return useAnimatedStyle(() => ({ width: `${width.value}%` }));
}
