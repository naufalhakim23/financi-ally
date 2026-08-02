import { AlertCircle, Inbox, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The four states every data view owes the user. They live together because
// they are one decision, not four: a screen that has a loading skeleton but no
// error card is a screen that shows an empty ledger when the API is down — the
// most alarming possible lie on a finance app.

/**
 * Skeleton rows shaped like the real list. Never a full-page spinner: a spinner
 * throws away the layout the user is about to read, and makes a 200ms fetch
 * look like a stall.
 */
export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="text-faint">{icon ?? <Inbox className="size-7" strokeWidth={1.5} />}</div>
      <p className="text-body-lg font-semibold text-ink">{title}</p>
      {hint ? <p className="text-body max-w-sm text-dim">{hint}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

/**
 * Inline error. Deliberately a card inside the section that failed, not a
 * page-level takeover — the rest of the page still holds real numbers and
 * hiding them helps nobody.
 */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-error-edge bg-error-wash flex items-start gap-3 rounded-lg border p-4",
        className,
      )}
    >
      <AlertCircle className="text-error mt-0.5 size-4 shrink-0" />
      <div className="flex-1 space-y-2">
        <p className="text-body text-error-strong">{message}</p>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Sticky offline banner. This client has no local queue, so going offline is
 * not a degraded mode that quietly recovers — it means writes are impossible,
 * and saying so beats a save button that fails.
 */
export function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-warning-edge bg-warning-wash text-warning-strong text-label flex items-center justify-center gap-2 border-b px-4 py-2"
    >
      <WifiOff className="size-3.5" />
      You&rsquo;re offline — changes can&rsquo;t be saved
    </div>
  );
}
