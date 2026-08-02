import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { buildEntryViews, groupByDay, monthCsv, monthLabel, monthKey } from "@financially/domain/ledger";

import { AddEntryButton } from "@/components/add-entry-button";
import { EntryRow } from "@/components/entry-row";
import { Amount } from "@/components/money";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { monthRange, useAccounts, useEntries } from "@/lib/queries";
import { useWording } from "@/lib/wording";

/**
 * History, one month at a time.
 *
 * Paging by month rather than infinite-scrolling the whole book is what keeps
 * an unpaginated GET /entries honest: each request is bounded by the range, and
 * "which month am I looking at" is the question people actually ask of a
 * ledger.
 */
export function HistoryRoute() {
  const { user } = useAuth();
  const { t } = useWording();
  const base = user?.base_currency ?? "IDR";

  const [cursor, setCursor] = useState(() => new Date());
  const range = useMemo(() => monthRange(cursor), [cursor]);

  const accountsQ = useAccounts();
  const entriesQ = useEntries(range.from, range.to);

  const views = useMemo(
    () => buildEntryViews(entriesQ.entries, entriesQ.lines, accountsQ.accounts),
    [entriesQ.entries, entriesQ.lines, accountsQ.accounts],
  );
  const days = useMemo(() => groupByDay(views, base), [views, base]);

  const shiftMonth = (by: number) =>
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + by, 1));

  const isCurrentMonth = monthKey(cursor) === monthKey(new Date());
  const loading = accountsQ.isPending || entriesQ.isPending;

  function exportCsv() {
    const blob = new Blob([monthCsv(views)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financially-${monthKey(cursor)}.csv`;
    a.click();
    // Revoking in the same tick cancels the download in Firefox and Safari —
    // the click only queues the fetch of the blob URL. One turn later is enough.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title text-ink font-bold">{t("history")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={views.length === 0} className="gap-1.5">
            <Download className="size-4" />
            Export
          </Button>
          <AddEntryButton size="sm" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-body-lg text-ink min-w-44 text-center font-semibold">
          {monthLabel(monthKey(cursor))}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(1)}
          // Nothing is posted in the future, so forward from this month leads to
          // a guaranteed empty screen.
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {entriesQ.error ? (
        <ErrorState
          message="Couldn't load this month. Check your connection and try again."
          onRetry={() => void entriesQ.refetch()}
        />
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="p-4">
            <LoadingRows rows={6} />
          </CardContent>
        </Card>
      ) : days.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="Nothing this month"
              hint="Entries you record will group by day here."
              action={
                <AddEntryButton />
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <section key={day.key}>
              <div className="flex items-baseline justify-between px-1 pb-1.5">
                <h2 className="text-label text-faint font-semibold">{day.label}</h2>
                <Amount currency={day.currency} minor={day.net} size="sm" tone="flow" showSign />
              </div>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-outline-variant divide-y">
                    {day.rows.map((view) => (
                      <EntryRow key={view.entry.id} view={view} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
