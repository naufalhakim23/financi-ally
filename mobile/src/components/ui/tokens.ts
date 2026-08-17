import type { ComponentType } from "react";
import { useColorScheme } from "nativewind";
import {
  ArrowLeftRight,
  Banknote,
  BookOpen,
  BarChart3,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Film,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Plane,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  Target,
  Users,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react-native";

// ─── JS-side tokens ─────────────────────────────────────────────────────────
// NativeWind covers colors/type/radii as utilities via the CSS variables in
// global.css. These are the values that can only be passed as props or style
// objects: shadows, placeholder colors, navigation chrome, and chart marks.
// They have to be duplicated in JS because a Lucide `color` prop or a
// `shadowOpacity` cannot read a CSS variable — keep them in step with
// global.css. DESIGN.md is the human-readable source of truth for both.

/** Semantic colors needed as raw values (props, not className). */
const LIGHT = {
  primary: "#1A1F2E",
  primaryPressed: "#2A3140",
  onPrimary: "#FFFFFF",
  background: "#F2F3F7",
  surface: "#FFFFFF",
  surfaceContainer: "#F0F1F6",
  surfaceContainerHigh: "#E8EAF2",
  ink: "#1A1F2E",
  dim: "#5A6379",
  faint: "#737C91",
  disabled: "#98A1B5",
  outline: "#E2E6F0",
  outlineVariant: "#F0F1F6",
  outlineStrong: "#C0C7DA",
  chevron: "#C0C7DA",
  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626",
  info: "#2563EB",
  scrim: "rgba(15,18,24,0.44)",
};

const DARK: typeof LIGHT = {
  primary: "#EEF0F6",
  primaryPressed: "#C0C7DA",
  onPrimary: "#131722",
  background: "#0F1218",
  surface: "#171B23",
  surfaceContainer: "#1E232D",
  surfaceContainerHigh: "#262C38",
  ink: "#EDEFF4",
  dim: "#A7AFC0",
  faint: "#8A93A8",
  disabled: "#5A6379",
  outline: "#2C3340",
  outlineVariant: "#232935",
  outlineStrong: "#3B4453",
  chevron: "#5A6379",
  success: "#3DBB6E",
  warning: "#E8A33D",
  error: "#F0666B",
  info: "#5B9CF8",
  scrim: "rgba(0,0,0,0.6)",
};

export type Palette = typeof LIGHT;

// Depth is tonal + hairline; shadows are near-invisible by design. Only the FAB
// and sheets genuinely float (see DESIGN.md → Elevation & depth). On dark a
// shadow reads as mud, so card/raised go inert and the tonal ladder plus the
// outline hairline carry the depth instead.
const LIGHT_ELEVATION = {
  card: {
    shadowColor: "#1A1F2E",
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    shadowOpacity: 0.06,
    elevation: 1,
  },
  raised: {
    shadowColor: "#1A1F2E",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.08,
    elevation: 3,
  },
  float: {
    shadowColor: "#1A1F2E",
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    shadowOpacity: 0.14,
    elevation: 8,
  },
};

const DARK_ELEVATION: typeof LIGHT_ELEVATION = {
  card: { ...LIGHT_ELEVATION.card, shadowOpacity: 0, elevation: 0 },
  raised: { ...LIGHT_ELEVATION.raised, shadowOpacity: 0, elevation: 0 },
  float: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    shadowOpacity: 0.5,
    elevation: 8,
  },
};

export type Elevation = typeof LIGHT_ELEVATION;

/**
 * The active palette and shadow set for the device color scheme.
 *
 * A hook rather than a constant because these are read during render — a module
 * constant would freeze whichever scheme was active when the bundle loaded.
 */
export function useTheme(): { C: Palette; ELEVATION: Elevation; dark: boolean } {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  return {
    C: dark ? DARK : LIGHT,
    ELEVATION: dark ? DARK_ELEVATION : LIGHT_ELEVATION,
    dark,
  };
}

// Glyph sizes. Lives in JS because Lucide takes `size` as a number, not a class.
// DESIGN.md -> Iconography lists the few deliberate off-scale one-offs.
export const ICON = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
} as const;

// Motion. RN has no CSS easing tokens, so only the durations travel; press
// feedback uses opacity/tone rather than a timing curve.
export const DURATION = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 360,
} as const;

/**
 * Categorical chart ramp — assigned by slot in a fixed order, never cycled and
 * never re-assigned when the series count changes. Validated on the #FFFFFF
 * card surface: worst adjacent CVD ΔE 9.1, normal-vision ΔE 19.6. Slots 3–5 sit
 * under 3:1 against the surface, which is why every chart using the ramp ships
 * a labelled legend — identity is never color-alone.
 */
export const CHART_SLOTS = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red — also the "Other" bucket
] as const;

/** Same hue at 12% alpha: the category tile / chip fill for that slot. */
export const CHART_SLOT_TINTS = [
  "rgba(42, 120, 214, 0.12)",
  "rgba(235, 104, 52, 0.12)",
  "rgba(27, 175, 122, 0.12)",
  "rgba(237, 161, 0, 0.12)",
  "rgba(232, 123, 164, 0.12)",
  "rgba(0, 131, 0, 0.12)",
  "rgba(74, 58, 167, 0.12)",
  "rgba(227, 73, 72, 0.12)",
] as const;

export const CHART_SLOT_COUNT = CHART_SLOTS.length;

/** Categorical color for slot i. Past the ramp, callers fold into "Other". */
export function slotColor(i: number): string {
  return CHART_SLOTS[Math.min(Math.max(i, 0), CHART_SLOT_COUNT - 1)];
}

export function slotTint(i: number): string {
  return CHART_SLOT_TINTS[Math.min(Math.max(i, 0), CHART_SLOT_COUNT - 1)];
}

/**
 * Stable slot for a category, derived from its id.
 *
 * DESIGN.md wants a category's list tint and its chart slice to share a slot,
 * assigned once and persisted. We have no column for that yet, so we derive it
 * from the id instead: stable across sessions and devices without a migration,
 * at the cost of not matching the rank-ordered slice color in Reports. Tracked
 * as an Open Gap in DESIGN.md.
 */
export function categorySlot(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % CHART_SLOT_COUNT;
}

export type Glyph = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// Keyword → glyph. Categories are user-named free text, so this is a best-effort
// match with a neutral fallback; it never blocks a category from existing.
const GLYPH_RULES: [RegExp, Glyph][] = [
  [/food|eat|restaurant|dining|grocer|meal/i, Utensils],
  [/coffee|cafe|drink|tea/i, Coffee],
  [/market|shop|store|belanja/i, ShoppingCart],
  [/cloth|fashion|apparel/i, ShoppingBag],
  [/transport|taxi|grab|gojek|fuel|car|parkir/i, Car],
  [/bus|train|kereta|transit|mrt/i, Bus],
  [/flight|travel|trip|plane|hotel/i, Plane],
  [/rent|home|house|kos|mortgage/i, Home],
  [/electric|water|utility|gas|listrik|pln/i, Zap],
  [/phone|internet|data|pulsa|wifi|subscription/i, Smartphone],
  [/health|medic|doctor|pharmacy|hospital/i, HeartPulse],
  [/school|course|tuition|education|book/i, GraduationCap],
  [/movie|game|entertain|music|hobby/i, Film],
  [/salary|income|payroll|bonus/i, Banknote],
  [/transfer/i, ArrowLeftRight],
  [/card|credit|kredit/i, CreditCard],
  [/bank|saving|tabungan/i, Landmark],
  [/cash|wallet|dompet|tunai/i, Wallet],
];

const TYPE_FALLBACK: Record<string, Glyph> = {
  asset: Wallet,
  liability: CreditCard,
  expense: Receipt,
  income: Banknote,
  equity: BarChart3,
};

/** Lucide glyph for an account / category. Never emoji (DESIGN.md → Iconography). */
export function accountGlyph(name: string, type?: string): Glyph {
  for (const [re, glyph] of GLYPH_RULES) if (re.test(name)) return glyph;
  return (type && TYPE_FALLBACK[type]) || Tag;
}

export { BookOpen, Receipt, Repeat, Target, Users, Wallet, BarChart3 };
