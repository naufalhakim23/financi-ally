import { Pressable, Text, View } from "react-native";

import { format } from "../lib/money";

// ─── Design-system atoms (DESIGN.md canon) ──────────────────────────────────
// Token-driven primitives shared across screens. Keep these dumb and composable;
// screen-specific layout stays in the screen.

// Soft elevation for floating panels (see DESIGN.md → Elevation).
const CARD_SHADOW = {
  shadowColor: "#1A1F2E",
  shadowOffset: { width: 0, height: 1 },
  shadowRadius: 4,
  shadowOpacity: 0.06,
  elevation: 1,
} as const;

/** White surface card with hairline border + soft shadow. */
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
      style={CARD_SHADOW}
    >
      {children}
    </View>
  );
}

/** ALL-CAPS structural label above a card group. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-faint text-[9px] font-sans-semibold uppercase tracking-widest">
      {children}
    </Text>
  );
}

/** Money figure: JetBrains Mono, signed + colored by direction. */
// minor = integer minor units (negative ⇒ expense). We group thousands for
// readability; the shared format() stays wire-pure (no grouping) so this is
// display-only.
export function Amount({
  minor,
  currency,
  size = "md",
  signed = true,
}: {
  minor: number;
  currency: string;
  size?: "sm" | "md" | "lg";
  signed?: boolean;
}) {
  const neg = minor < 0;
  // format() signs negatives itself; pass abs so the sign comes only from the
  // prefix below — otherwise we'd render "−-47.50".
  const raw = format(currency, Math.abs(minor));
  const [intPart, frac = ""] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac ? `${grouped}.${frac}` : grouped;
  const sizes = {
    sm: "text-[12px]",
    md: "text-[14px]",
    lg: "text-[28px]",
  } as const;
  return (
    <Text
      className={`font-mono-bold ${sizes[size]} ${neg ? "text-error" : "text-success"}`}
    >
      {signed ? (neg ? "−" : "+") : ""}
      {body}&nbsp;{currency}
    </Text>
  );
}

/** Semantic progress bar: <75% success, 75–99% warning, 100%+ error. */
export function ProgressBar({ pct }: { pct: number }) {
  const clipped = Math.max(0, Math.min(pct, 100));
  const color =
    pct >= 100 ? "bg-error" : pct >= 75 ? "bg-warning" : "bg-success";
  return (
    <View className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
      <View className={`h-1.5 rounded-full ${color}`} style={{ width: `${clipped}%` }} />
    </View>
  );
}

/** Emoji / icon inside a soft-tinted rounded square. */
export function IconBox({
  children,
  bg = "bg-secondary",
}: {
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <View
      className={`w-9 h-9 rounded-xl items-center justify-center shrink-0 ${bg}`}
    >
      <Text className="text-base">{children}</Text>
    </View>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";
const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-container-high text-dim",
  success: "bg-success-soft text-success border border-success-border",
  warning: "bg-warning-soft text-warning border border-warning-border",
  error: "bg-error-soft text-error border border-error-border",
  info: "bg-info-soft text-info border border-info-border",
};

/** Small status pill. Use status tones only for status meaning. */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <View className={`rounded-full px-2 py-0.5 ${BADGE_TONE[tone]}`}>
      <Text className="text-[10px] font-sans-semibold">{children}</Text>
    </View>
  );
}

type SegTone = "neutral" | "success" | "error" | "info";
const SEG_ACTIVE_TEXT: Record<SegTone, string> = {
  neutral: "text-primary",
  success: "text-success",
  error: "text-error",
  info: "text-info",
};

/** Segmented tab control (e.g. Expense / Income / Transfer). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; tone?: SegTone }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex flex-row rounded-2xl bg-surface-container-high p-1 gap-1">
      {options.map((o) => {
        const active = o.value === value;
        const tone = o.tone ?? "neutral";
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`flex-1 py-2 rounded-xl items-center ${
              active ? "bg-surface border border-outline" : ""
            }`}
          >
            <Text
              className={`text-[11px] font-sans-semibold ${
                active ? SEG_ACTIVE_TEXT[tone] : "text-faint"
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
