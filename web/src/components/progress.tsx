import { cn } from "@/lib/utils";

/**
 * Spent-vs-target bar.
 *
 * The fill is capped at 100% while the *color* keeps escalating past it, an
 * overspent budget must still read as a full bar, not a bar that has quietly
 * run off the end of its track.
 */
export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  // aria-valuenow is clamped, not raw: an overspent budget would report 140
  // against a max of 100, which is out of range. valuetext carries the truth.
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuetext={`${Math.round(pct)}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("bg-surface-container-high h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", toneFor(pct))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Over budget is an error, near it is a warning, under it is fine. */
export function toneFor(pct: number): string {
  return pct >= 100 ? "bg-error" : pct >= 75 ? "bg-warning" : "bg-success";
}

export function textToneFor(pct: number): string {
  return pct >= 100 ? "text-error-strong" : pct >= 75 ? "text-warning-strong" : "text-success-strong";
}
