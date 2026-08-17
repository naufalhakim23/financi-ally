import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Plus } from "lucide-react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { format } from "../../lib/money";
import {
  DURATION,
  EASING,
  HERO_LIGHT,
  ICON,
  fabShadow,
  type Palette,
  useTheme,
  type Glyph,
  slotColor,
  slotTint,
} from "./tokens";
import { haptic, type HapticKind } from "./haptics";
import { AnimatedPressable, PRESS_SCALE, useBarWidth, useReducedMotion } from "./motion";

/**
 * Pressed state as a boolean plus the handlers that drive it.
 *
 * NativeWind resolves `className` at build time, so Pressable's
 * `({ pressed }) => …` render-prop form only works for `style`. Tracking the
 * state ourselves keeps pressed styling in Tailwind classes like everything else.
 */
export function usePressed() {
  const [pressed, setPressed] = useState(false);
  return {
    pressed,
    handlers: {
      onPressIn: () => setPressed(true),
      onPressOut: () => setPressed(false),
    },
  };
}

// Press-scale + haptic variant of usePressed, split off so plain list rows don't allocate shared values. Render on AnimatedPressable.
export function usePressedScale(hapticKind?: HapticKind) {
  const [pressed, setPressed] = useState(false);
  const s = useSharedValue(1);
  // Reduced motion drops the transform; tone and haptic still answer the press.
  const reduced = useReducedMotion();
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: reduced ? 1 : s.value }] }));
  return {
    pressed,
    pressStyle,
    handlers: {
      onPressIn: () => {
        setPressed(true);
        s.value = withTiming(PRESS_SCALE, {
          duration: DURATION.instant,
          easing: EASING.standard,
        });
        if (hapticKind) haptic[hapticKind]();
      },
      onPressOut: () => {
        setPressed(false);
        s.value = withTiming(1, { duration: DURATION.fast, easing: EASING.exit });
      },
    },
  };
}

// ─── Core atoms (DESIGN.md v1.0) ────────────────────────────────────────────
// Token-driven primitives shared across screens. Keep these dumb and
// composable; screen-specific layout stays in the screen. Every interactive
// atom defines resting / pressed / disabled / loading.

/**
 * White surface card with hairline border + near-invisible elevation.
 *
 * `hero` is the one card per screen that carries the figure the screen is about:
 * roomier padding, plus `elevation.hero-light`, the one sanctioned gradient
 * (DESIGN.md → Elevation & depth). Light theme only — on dark the tonal ladder
 * carries the depth and a gradient would read as mud.
 */
export function Card({
  children,
  className = "",
  padded = true,
  hero = false,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  hero?: boolean;
}) {
  const { ELEVATION, dark } = useTheme();
  const lit = hero && !dark;
  return (
    <View
      className={`bg-surface rounded-2xl border border-outline ${lit ? "overflow-hidden" : ""} ${padded ? (hero ? "p-5" : "p-4") : ""} ${className}`}
      style={ELEVATION.card}
    >
      {lit && (
        <LinearGradient {...HERO_LIGHT} style={StyleSheet.absoluteFill} />
      )}
      {children}
    </View>
  );
}

/** ALL-CAPS structural label above a card group. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-faint text-overline font-sans-semibold uppercase">
      {children}
    </Text>
  );
}

type ButtonVariant = "primary" | "secondary" | "destructive" | "tertiary";

// Resting / pressed / disabled per variant. One Primary per screen — everything
// else demotes (DESIGN.md → Buttons).
const BUTTON_STYLE: Record<
  ButtonVariant,
  { base: string; pressed: string; disabled: string; text: string; disabledText: string }
> = {
  primary: {
    base: "bg-primary",
    pressed: "bg-primary-pressed",
    disabled: "bg-secondary",
    text: "text-on-primary",
    disabledText: "text-disabled",
  },
  secondary: {
    base: "bg-surface border border-outline",
    pressed: "bg-surface-pressed border border-outline",
    disabled: "bg-surface border border-outline-variant",
    text: "text-ink",
    disabledText: "text-disabled",
  },
  destructive: {
    base: "bg-error-wash border border-error-edge",
    pressed: "bg-error-edge border border-error-edge",
    disabled: "bg-surface-container border border-outline-variant",
    text: "text-error",
    disabledText: "text-disabled",
  },
  tertiary: {
    base: "",
    pressed: "opacity-60",
    disabled: "",
    text: "text-accent-strong",
    disabledText: "text-disabled",
  },
};

// Both the spinner and the glyph take the label's color. Lucide's default is
// `currentColor`, which react-native-svg has no cascade for — an unset glyph
// renders black on every variant, in both themes.
const labelColor = (C: Palette): Record<ButtonVariant, string> => ({
  primary: C.onPrimary,
  secondary: C.ink,
  destructive: C.error,
  tertiary: C.accentStrong,
});

/**
 * The one button. Loading swaps the label for a spinner in the label's color so
 * the button never changes width mid-request.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  glyph: G,
  fullWidth = true,
  className = "",
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  busy?: boolean;
  disabled?: boolean;
  glyph?: Glyph;
  fullWidth?: boolean;
  className?: string;
}) {
  const { C } = useTheme();
  const s = BUTTON_STYLE[variant];
  const off = disabled || busy;
  const tertiary = variant === "tertiary";
  const pad = tertiary ? "px-2 py-1" : "px-4 py-3.5 min-h-touch";
  const textColor = off ? s.disabledText : s.text;
  const { pressed, pressStyle, handlers } = usePressedScale("tapLight");

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      {...handlers}
      style={pressStyle}
      className={[
        "flex-row items-center justify-center",
        tertiary ? "" : "rounded-xl",
        pad,
        fullWidth && !tertiary ? "w-full" : "self-start",
        off ? s.disabled : pressed ? s.pressed : s.base,
        className,
      ].join(" ")}
    >
      {busy ? (
        <ActivityIndicator color={labelColor(C)[variant]} />
      ) : (
        <>
          {G && (
            <G size={ICON.lg} color={off ? C.disabled : labelColor(C)[variant]} strokeWidth={1.75} />
          )}
          <Text
            className={`${tertiary ? "text-label" : "text-body-strong"} font-sans-semibold ${textColor} ${G ? "ml-2" : ""}`}
          >
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

/** Floating add affordance. The only element besides sheets that truly floats. */
export function Fab({ onPress, size = 56 }: { onPress: () => void; size?: number }) {
  const { C, ELEVATION, dark } = useTheme();
  const { pressed, pressStyle, handlers } = usePressedScale("tapLight");
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add entry"
      {...handlers}
      className={`rounded-full items-center justify-center ${pressed ? "bg-accent-pressed" : "bg-accent"}`}
      style={[{ width: size, height: size }, fabShadow(C, ELEVATION, dark), pressStyle]}
    >
      <Plus size={ICON.xxl} color={C.onAccent} strokeWidth={1.75} />
    </AnimatedPressable>
  );
}

type AmountSize = "hero" | "lg" | "md" | "sm";
const AMOUNT_SIZE: Record<AmountSize, string> = {
  hero: "text-amount-hero font-mono-bold",
  lg: "text-amount-lg font-mono-bold",
  md: "text-amount font-mono-medium",
  sm: "text-amount-sm font-mono-medium",
};

// Display-only grouping. The shared format() stays wire-pure (no separators),
// so the thousands separators are added here rather than at the money layer.
export function formatGrouped(currency: string, minor: number): string {
  return grouped(currency, minor);
}

/** Thousands separators for a run of digits. Display only. */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function grouped(currency: string, minor: number): string {
  const raw = format(currency, Math.abs(minor));
  const [intPart, frac = ""] = raw.split(".");
  const withSeparators = groupDigits(intPart ?? "");
  return frac ? `${withSeparators}.${frac}` : withSeparators;
}

/**
 * Money figure. Sign and color are automatic in `flow` tone: `≥0` renders
 * success with `+`, `<0` renders error with `−` (U+2212, not a hyphen).
 * `neutral` tone is for figures that aren't a gain or loss — net worth, an
 * account balance — which render in ink, unsigned, going red only when negative.
 * Currency code precedes the figure; never a bare amount.
 */
export function Amount({
  minor,
  currency,
  size = "md",
  tone = "flow",
  converted,
  stale = false,
  align = "right",
}: {
  minor: number;
  currency: string;
  size?: AmountSize;
  tone?: "flow" | "neutral";
  converted?: { minor: number; currency: string };
  stale?: boolean;
  align?: "left" | "right";
}) {
  const neg = minor < 0;
  const color =
    tone === "flow"
      ? neg
        ? "text-error-strong"
        : "text-success-strong"
      : neg
        ? "text-error-strong"
        : "text-ink";
  const sign = tone === "flow" ? (neg ? "−" : "+") : neg ? "−" : "";

  return (
    <View className={align === "right" ? "items-end" : "items-start"}>
      <Text className={`${AMOUNT_SIZE[size]} ${color}`}>
        {sign}
        {currency}&nbsp;{grouped(currency, minor)}
      </Text>
      {converted && (
        <Text className="text-amount-sm font-mono-medium text-faint">
          ≈ {converted.currency}&nbsp;{grouped(converted.currency, converted.minor)}
        </Text>
      )}
      {stale && (
        <Text className="text-mono-meta font-mono text-warning-strong">stale rate</Text>
      )}
    </View>
  );
}

/** Semantic progress bar: <75% success, 75–99% warning, 100%+ error. */
export function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-error" : pct >= 75 ? "bg-warning" : "bg-success";
  const fill = useBarWidth(pct);
  return (
    <View className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
      {/* NativeWind resolves className at build time, so it stays off animated views. */}
      <Animated.View style={fill}>
        <View className={`h-1.5 w-full rounded-full ${color}`} />
      </Animated.View>
    </View>
  );
}

/**
 * 40px tinted tile holding a Lucide glyph. `slot` tints it from the chart ramp
 * so a category reads the same color wherever it appears; without a slot it
 * falls back to the quiet neutral fill. Ramp tints belong to categories only —
 * buckets and other structural rows stay neutral so the ramp keeps meaning
 * something. `accent` is the one-per-screen brand tile.
 */
export function IconBox({
  glyph: G,
  slot,
  tone = "neutral",
  size = 40,
}: {
  glyph: Glyph;
  slot?: number;
  tone?: "neutral" | "accent";
  size?: number;
}) {
  const { C } = useTheme();
  const tinted = slot != null;
  const fill = tinted ? "" : tone === "accent" ? "bg-accent-wash" : "bg-secondary";
  return (
    <View
      className={`rounded-tile items-center justify-center shrink-0 ${fill}`}
      style={[
        { width: size, height: size },
        tinted ? { backgroundColor: slotTint(slot) } : null,
      ]}
    >
      <G
        size={ICON.xl}
        color={tinted ? slotColor(slot) : tone === "accent" ? C.accentStrong : C.dim}
        strokeWidth={1.75}
      />
    </View>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";
const badgeTone = (C: Palette): Record<BadgeTone, { box: string; text: string; glyph: string }> => ({
  neutral: { box: "bg-surface-container-high", text: "text-dim", glyph: C.dim },
  success: { box: "bg-success-wash border border-success-edge", text: "text-success-strong", glyph: C.success },
  warning: { box: "bg-warning-wash border border-warning-edge", text: "text-warning-strong", glyph: C.warning },
  error: { box: "bg-error-wash border border-error-edge", text: "text-error-strong", glyph: C.error },
  info: { box: "bg-info-wash border border-info-edge", text: "text-info-strong", glyph: C.info },
});

/**
 * Small status pill. Status tones are for status meaning only, and always carry
 * a word (and optionally a glyph) — color is never the sole signal.
 */
export function Badge({
  children,
  tone = "neutral",
  glyph: G,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  glyph?: Glyph;
}) {
  const { C } = useTheme();
  const t = badgeTone(C)[tone];
  return (
    <View className={`flex-row items-center rounded-full px-2.5 py-0.5 ${t.box}`}>
      {G && <G size={ICON.xs} color={t.glyph} strokeWidth={1.75} />}
      <Text className={`text-caption font-sans-semibold ${t.text} ${G ? "ml-1" : ""}`}>
        {children}
      </Text>
    </View>
  );
}

/** Filter chip: inactive is a bordered surface, active fills with accent-strong
 * (the base accent fill doesn't clear AA for 13px text). */
export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const { pressed, pressStyle, handlers } = usePressedScale("tap");
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      {...handlers}
      style={pressStyle}
      className={`rounded-full px-3.5 py-2 border ${
        active
          ? "bg-accent-strong border-accent-strong"
          : pressed
            ? "bg-surface-pressed border-outline"
            : "bg-surface border-outline"
      }`}
    >
      <Text
        className={`text-label font-sans-semibold ${active ? "text-on-accent" : "text-ink"}`}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
