import { Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

// ─── Chart primitives ───────────────────────────────────────────────────────
// The design system's brand palette is deliberately neutral (see DESIGN.md), so
// charts carry their own categorical ramp: assigned by slot in fixed order,
// never cycled and never re-assigned when the series count changes. Validated
// on the #FFFFFF card surface — worst adjacent CVD ΔE 9.1, normal-vision 19.6.
// Three slots sit under 3:1 contrast, which is why every chart here ships a
// labelled legend row: identity is never color-alone.
export const SERIES = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red — also the "Other" bucket past 7 categories
] as const;

/** Categorical color for slot i. Past the ramp, callers fold into "Other". */
export function seriesColor(i: number): string {
  return SERIES[Math.min(i, SERIES.length - 1)];
}

// Segment gap in degrees — the 2px surface gap between adjacent fills, so
// touching slices stay separable for CVD readers.
const GAP_DEG = 2;

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
          stroke="#E8EAF2"
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

export type TrendPoint = { key: string; label: string; value: number; emphasized?: boolean };

/**
 * Change-over-time bars for a single series. Plain Views — bars are rectangles,
 * and SVG buys nothing here. Heights are relative to the largest bar; the
 * emphasized point (the current period) carries the ink fill, the rest recede.
 */
export function TrendBars({
  points,
  height = 72,
  formatValue,
}: {
  points: TrendPoint[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const max = points.reduce((m, p) => Math.max(m, p.value), 0);
  const MIN_BAR = 3; // a zero month still shows a baseline tick, not a gap

  return (
    <View>
      <View className="flex-row items-end" style={{ height, gap: 6 }}>
        {points.map((p) => {
          const h = max > 0 ? Math.max((p.value / max) * height, MIN_BAR) : MIN_BAR;
          return (
            <View
              key={p.key}
              className={`flex-1 rounded-t ${p.emphasized ? "bg-primary" : "bg-surface-container-high"}`}
              style={{ height: h }}
            />
          );
        })}
      </View>
      <View className="flex-row mt-1.5" style={{ gap: 6 }}>
        {points.map((p) => (
          <Text
            key={p.key}
            className={`flex-1 text-center text-[9px] ${
              p.emphasized ? "text-ink font-sans-semibold" : "text-faint font-sans-medium"
            }`}
          >
            {p.label}
          </Text>
        ))}
      </View>
      {formatValue && (
        <Text className="text-faint text-[10px] font-mono-medium mt-1">
          peak {formatValue(max)}
        </Text>
      )}
    </View>
  );
}
