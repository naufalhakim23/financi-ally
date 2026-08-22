import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Chip, usePressed } from "./core";
import { Sheet } from "./overlays";
import { useTheme } from "./tokens";
import { addDays, dayLabel, monthCells, shiftMonth, startOfDay, startOfMonth } from "../../lib/day";

// ─── Date picking (DESIGN.md v1.0 → Bottom sheets) ──────────────────────────
// A month grid in a Sheet rather than the OS picker: the add sheet already owns
// the bottom of the screen with its own keypad, and a native picker fights it
// for that space with a different shape on each platform. The calendar math
// lives in lib/day.ts so it stays testable.

export { dayLabel, startOfDay };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const CELL = `${100 / 7}%`;

/**
 * Pick the date an entry happened on. Future days are unreachable — an entry is
 * a record of something that already happened; a dated-forward one belongs to
 * recurring rules.
 */
export function DateSheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: number;
  onClose: () => void;
  onSelect: (ms: number) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="When">
      {/* Remounted per open, so the month cursor always starts on the day the
          entry currently carries rather than wherever it was last left. */}
      {visible && <MonthGrid value={value} onSelect={onSelect} />}
    </Sheet>
  );
}

function MonthGrid({ value, onSelect }: { value: number; onSelect: (ms: number) => void }) {
  const selected = startOfDay(value);
  const today = startOfDay(Date.now());
  const yesterday = startOfDay(addDays(today, -1));
  const [cursor, setCursor] = useState(() => startOfMonth(selected));

  const cells = monthCells(cursor);
  const nextMonthStart = shiftMonth(cursor, 1);

  return (
    <View>
      <View className="flex-row pb-3" style={{ gap: 8 }}>
        <Chip label="Today" active={selected === today} onPress={() => onSelect(today)} />
        <Chip
          label="Yesterday"
          active={selected === yesterday}
          onPress={() => onSelect(yesterday)}
        />
      </View>

      <View className="flex-row items-center justify-between py-1">
        <Arrow
          glyph={ChevronLeft}
          label="Previous month"
          onPress={() => setCursor(shiftMonth(cursor, -1))}
        />
        <Text className="text-body-strong font-sans-semibold text-ink">
          {new Date(cursor).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </Text>
        <Arrow
          glyph={ChevronRight}
          label="Next month"
          // Nothing to reach: every day in a later month is in the future.
          disabled={nextMonthStart > today}
          onPress={() => setCursor(nextMonthStart)}
        />
      </View>

      <View className="flex-row">
        {WEEKDAYS.map((d, i) => (
          <Text
            key={i}
            className="text-overline font-sans-semibold text-faint uppercase text-center"
            style={{ width: CELL }}
          >
            {d}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap pb-2">
        {cells.map((ms, i) =>
          ms == null ? (
            <View key={`pad-${i}`} style={{ width: CELL, aspectRatio: 1 }} />
          ) : (
            <DayCell
              key={ms}
              ms={ms}
              selected={ms === selected}
              disabled={ms > today}
              onPress={() => onSelect(ms)}
            />
          ),
        )}
      </View>
    </View>
  );
}

function DayCell({
  ms,
  selected,
  disabled,
  onPress,
}: {
  ms: number;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { pressed, handlers } = usePressed();
  const date = new Date(ms);
  return (
    <View style={{ width: CELL, aspectRatio: 1 }} className="p-0.5">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={date.toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        {...handlers}
        className={`flex-1 rounded-full items-center justify-center ${
          selected ? "bg-primary" : pressed && !disabled ? "bg-surface-pressed" : ""
        }`}
      >
        <Text
          className={`text-body font-mono-medium ${
            selected ? "text-on-primary" : disabled ? "text-disabled" : "text-ink"
          }`}
        >
          {date.getDate()}
        </Text>
      </Pressable>
    </View>
  );
}

function Arrow({
  glyph: G,
  label,
  disabled = false,
  onPress,
}: {
  glyph: typeof ChevronLeft;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { C } = useTheme();
  const { pressed, handlers } = usePressed();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...handlers}
      className={`w-11 h-11 rounded-full items-center justify-center ${
        pressed && !disabled ? "bg-surface-pressed" : ""
      }`}
    >
      <G size={20} color={disabled ? C.disabled : C.dim} strokeWidth={1.75} />
    </Pressable>
  );
}
