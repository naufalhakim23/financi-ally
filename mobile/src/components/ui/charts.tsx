import { Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { CHART_SLOTS, slotColor, useTheme } from "./tokens";

// ─── Chart primitives (DESIGN.md v1.0 → Charts) ─────────────────────────────
// The brand palette is deliberately neutral, so it can't encode series
// identity. Charts carry the categorical ramp from tokens.ts, assigned by slot
// in fixed order and never re-assigned when the series count changes — a filter
// must not repaint the survivors. Three slots sit under 3:1 against the card
// surface, which is why every chart using the ramp ships a labelled legend.

export { CHART_SLOTS as SERIES, slotColor as seriesColor };

// Segment gap in degrees — the 2px surface gap between adjacent fills, so
// touching slices stay separable for CVD readers.
const GAP_DEG = 2;

// Bar corner softening. Below the smallest shape token on purpose: a 6px radius
// on a 10px-wide bar eats the bar.
const BAR_RADIUS = 3;

export type DonutSlice = { id: string; value: number; color: string };

/**
 * Donut of part-to-whole shares. Rendered as one stroked arc per slice via
 * dash offsets (an SVG circle is cheaper and steadier than hand-built arc
 * paths). Slices arrive pre-sorted; order defines color slots.
 */
export function Donut({
  slices,
  size = 148,
  thickness = 22,
  center,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
}) {
  const { C } = useTheme();
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let cursorDeg = 0;
  const arcs = total > 0
    ? slices.map((s) => {
        const share = Math.max(0, s.value) / total;
        const sweep = share * 360;
        // A gap only fits when the slice is wider than it; hairline slices keep
        // their full sweep rather than vanishing.
        const drawn = sweep > GAP_DEG * 2 ? sweep - GAP_DEG : sweep;
        const arc = { id: s.id, color: s.color, start: cursorDeg, len: (drawn / 360) * circumference };
        cursorDeg += sweep;
        return arc;
      })
    : [];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Track: reads as "no data" when total is 0 and as the ring base otherwise. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={C.surfaceContainerHigh}
          strokeWidth={thickness}
          fill="none"
        />
        {/* −90° puts slot 1 at 12 o'clock. */}
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {arcs.map((a) => (
            <Circle
              key={a.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={a.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
              fill="none"
              strokeDasharray={`${a.len} ${circumference - a.len}`}
              strokeDashoffset={-(a.start / 360) * circumference}
            />
          ))}
        </G>
      </Svg>
      {center && (
        <View className="absolute inset-0 items-center justify-center">{center}</View>
      )}
    </View>
  );
}

export type LegendItem = {
  id: string;
  label: string;
  value: number;
  color: string;
  /** Second line, e.g. what a folded "everything else" row covers. */
  note?: string;
};

/**
 * Mandatory companion to any ramp chart: it doubles as the value table, so
 * identity never rests on color alone. Values and labels stay in ink/faint —
 * series color belongs to marks only.
 */
export function ChartLegend({
  items,
  formatValue,
  showShare = true,
}: {
  items: LegendItem[];
  formatValue: (v: number) => string;
  /** Off when the legend sits beside its chart — the share column has no room. */
  showShare?: boolean;
}) {
  const total = items.reduce((s, x) => s + x.value, 0);
  return (
    <View>
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <View key={item.id} className="flex-row items-center py-2" style={{ gap: 10 }}>
            <View
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <View className="flex-1 min-w-0">
              <Text className="text-body font-sans text-ink" numberOfLines={1}>
                {item.label}
              </Text>
              {item.note && (
                <Text className="text-caption font-sans-medium text-faint" numberOfLines={1}>
                  {item.note}
                </Text>
              )}
            </View>
            {showShare && (
              <Text className="text-amount-sm font-mono-medium text-faint">{pct}%</Text>
            )}
            <Text className="text-amount-sm font-mono-bold text-ink">
              {formatValue(item.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type TrendPoint = { key: string; label: string; value: number; emphasized?: boolean };

/**
 * Change-over-time bars for a single series. Plain Views — bars are rectangles,
 * and SVG buys nothing here. Heights are relative to the largest bar; the
 * emphasized point (the current period) carries the accent fill, the rest recede.
 * Single-series, so no ramp and no legend.
 */
export function TrendBars({
  points,
  height = 72,
  gap = 6,
  showLabels = true,
  formatValue,
}: {
  points: TrendPoint[];
  height?: number;
  gap?: number;
  /** Off for the dense Home sparkline, where twelve labels would not fit. */
  showLabels?: boolean;
  formatValue?: (v: number) => string;
}) {
  const max = points.reduce((m, p) => Math.max(m, p.value), 0);
  const MIN_BAR = 3; // a zero month still shows a baseline tick, not a gap

  return (
    <View>
      <View className="flex-row items-end" style={{ height, gap }}>
        {points.map((p) => {
          const h = max > 0 ? Math.max((p.value / max) * height, MIN_BAR) : MIN_BAR;
          return (
            <View
              key={p.key}
              className={`flex-1 ${p.emphasized ? "bg-accent" : "bg-surface-container-high"}`}
              style={{ height: h, borderRadius: BAR_RADIUS }}
            />
          );
        })}
      </View>
      {showLabels && (
        <View className="flex-row mt-1.5" style={{ gap }}>
          {points.map((p) => (
            <Text
              key={p.key}
              className={`flex-1 text-center text-caption ${
                p.emphasized ? "text-ink font-sans-semibold" : "text-faint font-sans-medium"
              }`}
            >
              {p.label}
            </Text>
          ))}
        </View>
      )}
      {formatValue && (
        <Text className="text-mono-meta font-mono text-faint mt-1">peak {formatValue(max)}</Text>
      )}
    </View>
  );
}

export type StackSegment = { id: string; value: number; color: string };

/**
 * One horizontal bar split into shares — "where it went". Reads as a single
 * object rather than a chart, so it carries no axis; the legend beneath it (a
 * `ChartLegend` or a hand-laid grid) supplies identity and value.
 */
export function StackedBar({ segments, height = 12 }: { segments: StackSegment[]; height?: number }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <View
      className="flex-row rounded-full overflow-hidden bg-surface-container-high"
      style={{ height }}
    >
      {total > 0 &&
        segments.map((s) => (
          <View
            key={s.id}
            style={{ flexGrow: Math.max(0, s.value), flexBasis: 0, backgroundColor: s.color }}
          />
        ))}
    </View>
  );
}

export type GroupedPoint = { key: string; label: string; a: number; b: number };

/**
 * Two series side by side per period — money in against money out. Two series
 * means identity can no longer come from position alone, so the caller must
 * ship the legend (`aLabel` / `bLabel` name what each fill means).
 */
export function GroupedBars({
  points,
  height = 88,
  aColor,
  bColor,
}: {
  points: GroupedPoint[];
  height?: number;
  aColor?: string;
  bColor?: string;
}) {
  // Defaults resolve at render, not at module load, so they follow the theme.
  const { C } = useTheme();
  const a = aColor ?? C.success;
  const b = bColor ?? C.primary;
  const max = points.reduce((m, p) => Math.max(m, p.a, p.b), 0);
  const MIN_BAR = 3;
  const bar = (v: number) => (max > 0 ? Math.max((v / max) * height, MIN_BAR) : MIN_BAR);

  return (
    <View>
      <View className="flex-row items-end" style={{ height, gap: 10 }}>
        {points.map((p) => (
          <View key={p.key} className="flex-1 flex-row items-end" style={{ gap: 3, height }}>
            <View
              className="flex-1"
              style={{ height: bar(p.a), backgroundColor: a, borderRadius: BAR_RADIUS }}
            />
            <View
              className="flex-1"
              style={{ height: bar(p.b), backgroundColor: b, borderRadius: BAR_RADIUS }}
            />
          </View>
        ))}
      </View>
      <View className="flex-row mt-1.5" style={{ gap: 10 }}>
        {points.map((p) => (
          <Text
            key={p.key}
            className="flex-1 text-center text-mono-meta font-mono text-faint"
          >
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Legend swatch + label pair, for charts that lay their own legend out. */
export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 5 }}>
      <View className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <Text className="text-caption font-sans-medium text-dim">{label}</Text>
    </View>
  );
}
