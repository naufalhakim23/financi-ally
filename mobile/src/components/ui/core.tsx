import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Plus } from "lucide-react-native";

import { format } from "../../lib/money";
import { C, ELEVATION, type Glyph, slotColor, slotTint } from "./tokens";

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

// ─── Core atoms (DESIGN.md v1.0) ────────────────────────────────────────────
// Token-driven primitives shared across screens. Keep these dumb and
// composable; screen-specific layout stays in the screen. Every interactive
// atom defines resting / pressed / disabled / loading.

/** White surface card with hairline border + near-invisible elevation. */
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <View
      className={`bg-surface rounded-2xl border border-outline ${padded ? "p-4" : ""} ${className}`}
      style={ELEVATION.card}
    >
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
    text: "text-info",
    disabledText: "text-disabled",
  },
};

const SPINNER_COLOR: Record<ButtonVariant, string> = {
  primary: C.onPrimary,
  secondary: C.ink,
  destructive: C.error,
  tertiary: C.info,
};

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
  const s = BUTTON_STYLE[variant];
  const off = disabled || busy;
  const tertiary = variant === "tertiary";
  const pad = tertiary ? "px-2 py-1" : "px-4 py-3.5 min-h-touch";
  const textColor = off ? s.disabledText : s.text;
  const { pressed, handlers } = usePressed();

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      {...handlers}
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
        <ActivityIndicator color={SPINNER_COLOR[variant]} />
      ) : (
        <>
          {G && <G size={18} color={off ? C.disabled : undefined} strokeWidth={1.75} />}
          <Text
            className={`${tertiary ? "text-label" : "text-body-strong"} font-sans-semibold ${textColor} ${G ? "ml-2" : ""}`}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Floating add affordance. The only element besides sheets that truly floats. */
export function Fab({ onPress, size = 56 }: { onPress: () => void; size?: number }) {
  const { pressed, handlers } = usePressed();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add entry"
      {...handlers}
      className={`rounded-full items-center justify-center ${pressed ? "bg-primary-pressed" : "bg-primary"}`}
      style={[{ width: size, height: size }, ELEVATION.float]}
    >
      <Plus size={24} color={C.onPrimary} strokeWidth={1.75} />
    </Pressable>
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

function grouped(currency: string, minor: number): string {
  const raw = format(currency, Math.abs(minor));
  const [intPart, frac = ""] = raw.split(".");
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
    tone === "flow" ? (neg ? "text-error" : "text-success") : neg ? "text-error" : "text-ink";
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
        <Text className="text-mono-meta font-mono text-warning">stale rate</Text>
      )}
    </View>
  );
}

/** Semantic progress bar: <75% success, 75–99% warning, 100%+ error. */
export function ProgressBar({ pct }: { pct: number }) {
  const clipped = Math.max(0, Math.min(pct, 100));
  const color = pct >= 100 ? "bg-error" : pct >= 75 ? "bg-warning" : "bg-success";
  return (
    <View className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
      <View className={`h-1.5 rounded-full ${color}`} style={{ width: `${clipped}%` }} />
    </View>
  );
}

/**
 * 40px tinted tile holding a Lucide glyph. `slot` tints it from the chart ramp
 * so a category reads the same color wherever it appears; without a slot it
 * falls back to the quiet neutral fill.
 */
export function IconBox({
  glyph: G,
  slot,
  size = 40,
}: {
  glyph: Glyph;
  slot?: number;
  size?: number;
}) {
  const tinted = slot != null;
  return (
    <View
      className={`rounded-xl items-center justify-center shrink-0 ${tinted ? "" : "bg-secondary"}`}
      style={[
        { width: size, height: size },
        tinted ? { backgroundColor: slotTint(slot) } : null,
      ]}
    >
      <G size={20} color={tinted ? slotColor(slot) : C.dim} strokeWidth={1.75} />
    </View>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";
const BADGE_TONE: Record<BadgeTone, { box: string; text: string; glyph: string }> = {
  neutral: { box: "bg-surface-container-high", text: "text-dim", glyph: C.dim },
  success: { box: "bg-success-wash border border-success-edge", text: "text-success", glyph: C.success },
  warning: { box: "bg-warning-wash border border-warning-edge", text: "text-warning", glyph: C.warning },
  error: { box: "bg-error-wash border border-error-edge", text: "text-error", glyph: C.error },
  info: { box: "bg-info-wash border border-info-edge", text: "text-info", glyph: C.info },
};

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
  const t = BADGE_TONE[tone];
  return (
    <View className={`flex-row items-center rounded-full px-2.5 py-0.5 ${t.box}`}>
      {G && <G size={12} color={t.glyph} strokeWidth={1.75} />}
      <Text className={`text-caption font-sans-semibold ${t.text} ${G ? "ml-1" : ""}`}>
        {children}
      </Text>
    </View>
  );
}

/** Filter chip: inactive is a bordered surface, active fills with primary. */
export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const { pressed, handlers } = usePressed();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      {...handlers}
      className={`rounded-full px-3.5 py-2 border ${
        active
          ? "bg-primary border-primary"
          : pressed
            ? "bg-surface-pressed border-outline"
            : "bg-surface border-outline"
      }`}
    >
      <Text
        className={`text-label font-sans-semibold ${active ? "text-on-primary" : "text-ink"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
