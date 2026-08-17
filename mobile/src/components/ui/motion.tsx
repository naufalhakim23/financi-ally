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
// Reduced-motion lives here, not in callers: opacity stays, transform/width drop.

// Discrete affordances only. On a full-width row this reads as a card flinch.
export const PRESS_SCALE = 0.97;

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export { useReducedMotion };

// Headline figures only. Amount would allocate one of these per ledger row.
export function useValueFade(value: number) {
  const opacity = useSharedValue(1);
  const reduced = useReducedMotion();
  // Skip the first commit, or every mount blinks the figure.
  const settled = useRef(false);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    const half = { duration: DURATION.fast / 2, easing: EASING.linear };
    opacity.value = withTiming(0, half, (done) => {
      "worklet";
      // An interrupted fade already has a successor; fading back in would fight it.
      if (done) opacity.value = withTiming(1, half);
    });
  }, [value, opacity]);

  return useAnimatedStyle(() => ({ opacity: reduced ? 1 : opacity.value }));
}

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
