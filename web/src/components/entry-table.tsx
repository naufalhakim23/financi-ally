import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { Link, useLocation } from "react-router";

import { signedAmount, type EntryView } from "@financially/domain/ledger";

import { Amount } from "@/components/money";
import { useWording } from "@/lib/wording";

// The ledger at desktop density: one row per entry, five aligned columns.
//
// The same entries render as `EntryRow` on the history screen, and that is not
// duplication for its own sake — a two-line stacked row is the right shape in a
// narrow column, and a five-column grid is the right shape across 900px. This
// component collapses to the same two-line shape below `md` by hiding the
// middle columns, so there is one row implementation per layout, not per
// breakpoint.

const GLYPH = { out: ArrowUpRight, in: ArrowDownLeft, move: ArrowLeftRight } as const;

const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 md:grid-cols-[104px_minmax(0,1fr)_150px_92px_140px]";

export function EntryTable({ views }: { views: EntryView[] }) {
  const { t } = useWording();

  return (
    <div role="table" aria-label={t("history")}>
      <div
        role="row"
        className={`${COLUMNS} text-overline text-faint bg-surface-container py-2.5 font-semibold tracking-wide uppercase`}
      >
        <span role="columnheader" className="hidden md:block">
          When
        </span>
        <span role="columnheader">Entry</span>
        <span role="columnheader" className="hidden md:block">
          Posted to
        </span>
        <span role="columnheader" className="hidden md:block">
          Type
        </span>
        <span role="columnheader" className="text-right">
          Amount
        </span>
      </div>

      <div className="divide-outline-variant divide-y">
        {views.map((view) => (
          <EntryTableRow key={view.entry.id} view={view} />
        ))}
      </div>
    </div>
  );
}

function EntryTableRow({ view }: { view: EntryView }) {
  const { showSides, t } = useWording();
  // Opening an entry is a modal over wherever you already were; `background`
  // tells the router which route to keep rendering underneath. See App.tsx.
  const background = useLocation();

  const category = view.direction === "out" ? view.to : view.from;
  const Glyph = GLYPH[view.direction];
  const isMove = view.direction === "move";
  const date = new Date(view.entry.txnDate);

  return (
    <Link
      role="row"
      to={`/app/entry/${view.entry.id}`}
      state={{ background }}
      className={`${COLUMNS} hover:bg-surface-pressed focus-visible:ring-focus-ring py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2`}
    >
      <span role="cell" className="text-amount-sm text-faint tabular hidden font-mono md:block">
        {date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })}
      </span>

      <span role="cell" className="flex min-w-0 items-center gap-3">
        <span
          className={
            view.direction === "in"
              ? "bg-success-wash text-success-strong grid size-8 shrink-0 place-items-center rounded-lg"
              : "bg-surface-container text-dim grid size-8 shrink-0 place-items-center rounded-lg"
          }
        >
          <Glyph className="size-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="text-body text-ink block truncate font-semibold">
            {view.entry.memo || category?.name || "Entry"}
          </span>
          <span className="text-caption text-faint block truncate">
            {/* Below md the two hidden columns have to live somewhere, or the
                row loses which accounts it moved money between. */}
            <span className="md:hidden">
              {showSides
                ? `${t("outOf")} ${view.from?.name ?? "—"} · ${t("into")} ${view.to?.name ?? "—"}`
                : `${view.from?.name ?? "—"} → ${view.to?.name ?? "—"}`}
              {" · "}
              {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
            <span className="hidden md:inline">{category?.name ?? "—"}</span>
          </span>
        </span>
      </span>

      <span role="cell" className="text-body text-dim hidden truncate md:block">
        {view.direction === "out" ? (view.from?.name ?? "—") : (view.to?.name ?? "—")}
      </span>

      <span role="cell" className="hidden md:block">
        <span className="text-caption bg-surface-container-high text-dim rounded-full px-2 py-0.5 font-semibold">
          {isMove ? "move" : view.direction === "in" ? "in" : "out"}
        </span>
      </span>

      <span role="cell" className="flex justify-end">
        {/* A move is neither income nor spending, so it carries no sign. */}
        <Amount
          currency={view.currency}
          minor={isMove ? view.amountMinor : signedAmount(view)}
          tone="flow"
          showSign={!isMove}
        />
      </span>
    </Link>
  );
}
