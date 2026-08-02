import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { Link, useLocation } from "react-router";

import { signedAmount, type EntryView } from "@financially/domain/ledger";

import { Amount } from "@/components/money";
import { cn } from "@/lib/utils";
import { useWording } from "@/lib/wording";

// One entry, as a row. The mobile app's entry-row.tsx in DOM form, minus the
// unsynced badge — an online-only client has no such state, because there is no
// local write that the server hasn't seen.

const GLYPH = {
  out: ArrowUpRight,
  in: ArrowDownLeft,
  move: ArrowLeftRight,
} as const;

export function EntryRow({ view, className }: { view: EntryView; className?: string }) {
  const { showSides, t } = useWording();
  // Opening an entry is a modal over wherever you already were; `background`
  // tells the router which route to keep rendering underneath. See App.tsx.
  const location = useLocation();

  // The row is named after the category it touched, not the pocket: "Groceries"
  // is what the user remembers spending on, "BCA" is where every row came from.
  const category = view.direction === "out" ? view.to : view.from;
  const Glyph = GLYPH[view.direction];
  const isMove = view.direction === "move";
  const date = new Date(view.entry.txnDate);

  return (
    <li className={cn("hover:bg-surface-pressed transition-colors", className)}>
      <Link
        to={`/app/entry/${view.entry.id}`}
        state={{ background: location }}
        className="focus-visible:ring-focus-ring flex items-center gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2"
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            view.direction === "in" ? "bg-success-wash text-success-strong" : "bg-surface-container text-dim",
          )}
        >
          <Glyph className="size-4" strokeWidth={1.75} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-body text-ink block truncate font-medium">
            {view.entry.memo || category?.name || "Entry"}
          </span>
          <span className="text-caption text-faint block truncate">
            {showSides
              ? `${t("outOf")} ${view.from?.name ?? "—"} · ${t("into")} ${view.to?.name ?? "—"}`
              : `${view.from?.name ?? "—"} → ${view.to?.name ?? "—"}`}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end">
          {/* A move is neither income nor spending, so it carries no sign. */}
          <Amount
            currency={view.currency}
            minor={isMove ? view.amountMinor : signedAmount(view)}
            tone="flow"
            showSign={!isMove}
          />
          <span className="text-caption text-faint">
            {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </span>
        </span>
      </Link>
    </li>
  );
}
