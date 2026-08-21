import { View } from "react-native";
import { router } from "expo-router";
import { RefreshCw } from "lucide-react-native";

import type { EntryView, groupByDay } from "../lib/ledger";
import { useStrings, type Strings } from "../lib/wording";
import { Card, Chip, DayHeader, ListRow, accountGlyph, categorySlot, formatGrouped } from "./ui";

/**
 * One ledger row, shared by History and Month detail.
 *
 * Not part of the UI kit: it knows what an entry is. The kit stays ignorant of
 * the domain, and this composes it.
 *
 * The category drives the icon and its chart slot; the amount carries the
 * direction (out red, in green, a move neutral) and the running balance sits
 * beneath it in mono, so a column of these reads as a ledger without a second
 * column of chrome.
 */
export function EntryRow({
  view: v,
  base,
  divider = false,
}: {
  view: EntryView;
  base: string;
  divider?: boolean;
}) {
  const s = useStrings();
  const category = v.direction === "out" ? v.to : v.from;
  const signed = v.direction === "out" ? -v.amountMinor : v.amountMinor;
  const move = v.direction === "move";

  // A local write the server has not acknowledged yet. It outranks the flow
  // line in the subtitle slot: which accounts it touched is on the detail
  // screen anyway, whereas "this only exists on your phone" is not.
  // `syncStatus` is WatermelonDB's own column, not part of the shared domain
  // record — the online-only web client has no such state — so it is read off
  // the model here rather than declared in shared-context/domain/types.ts.
  const unsynced = (v.entry as { syncStatus?: string }).syncStatus !== "synced";

  return (
    <ListRow
      divider={divider}
      glyph={accountGlyph(category?.name ?? v.entry.memo ?? "", category?.type)}
      slot={category ? categorySlot(category.id) : undefined}
      title={v.entry.memo || category?.name || s.entry.row.fallbackTitle}
      subtitleTone={unsynced ? "warning" : "faint"}
      subtitleGlyph={unsynced ? RefreshCw : undefined}
      subtitle={
        unsynced
          ? s.entry.row.unsynced
          : s.entry.row.flow(
              v.from?.name ?? s.common.missing,
              v.to?.name ?? s.common.missing,
              move,
            )
      }
      amount={move ? v.amountMinor : signed}
      currency={v.currency || base}
      amountTone={move ? "neutral" : "flow"}
      meta={
        v.runningBalance != null && v.runningCurrency
          ? s.entry.row.runningBalance(formatGrouped(v.runningCurrency, v.runningBalance))
          : undefined
      }
      onPress={() => router.push(`/(app)/entry/${v.entry.id}`)}
    />
  );
}

// Day-grouped ledger shared by History and Month detail.
export function EntryDayList({
  days,
  base,
}: {
  days: ReturnType<typeof groupByDay>;
  base: string;
}) {
  return (
    <>
      {days.map((day) => (
        <View key={day.key} style={{ gap: 8 }}>
          <DayHeader
            label={day.label}
            total={`${day.net < 0 ? "−" : "+"}${formatGrouped(base, Math.abs(day.net))}`}
          />
          <Card padded={false}>
            {day.rows.map((v, i) => (
              <EntryRow key={v.entry.id} view={v} base={base} divider={i > 0} />
            ))}
          </Card>
        </View>
      ))}
    </>
  );
}

export type DirFilter = "all" | "in" | "out" | "move";

const DIR_ORDER: DirFilter[] = ["all", "in", "out", "move"];

export function dirLabels(s: Strings): Record<DirFilter, string> {
  return s.entry.direction;
}

// Direction filter shared by History's sheet and Month detail's inline row.
export function DirChips({ value, onChange }: { value: DirFilter; onChange: (d: DirFilter) => void }) {
  const labels = dirLabels(useStrings());
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {DIR_ORDER.map((d) => (
        <Chip key={d} label={labels[d]} active={value === d} onPress={() => onChange(d)} />
      ))}
    </View>
  );
}
