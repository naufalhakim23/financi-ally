import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled input with its error wired up for screen readers.
 *
 * The `aria-describedby`/`aria-invalid` pairing is the part that is easy to
 * forget and impossible to notice by looking, so it lives in one component
 * rather than at every call site.
 */
export function Field({
  label,
  error,
  hint,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; error?: string | null; hint?: string }) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-label text-ink">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(error && "border-error focus-visible:ring-error/40")}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-caption text-error-strong">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
