import { router } from "expo-router";

import type { EntryView } from "../lib/ledger";
import { ListRow, accountGlyph, categorySlot, formatGrouped } from "./ui";

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
  const category = v.direction === "out" ? v.to : v.from;
  const signed = v.direction === "out" ? -v.amountMinor : v.amountMinor;
  const move = v.direction === "move";

  return (
    <ListRow
      divider={divider}
      glyph={accountGlyph(category?.name ?? v.entry.memo ?? "", category?.type)}
      slot={category ? categorySlot(category.id) : undefined}
      title={v.entry.memo || category?.name || "Entry"}
      subtitle={`${v.from?.name ?? "—"} → ${v.to?.name ?? "—"}${move ? " · move" : ""}`}
      amount={move ? v.amountMinor : signed}
      currency={v.currency || base}
      amountTone={move ? "neutral" : "flow"}
      meta={
        v.runningBalance != null && v.runningCurrency
          ? `bal ${formatGrouped(v.runningCurrency, v.runningBalance)}`
          : undefined
      }
      onPress={() => router.push(`/(app)/entry/${v.entry.id}`)}
    />
  );
}
