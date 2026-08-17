import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: string };

/**
 * A small set of mutually exclusive choices, as one control.
 *
 * Built on real radio inputs rather than buttons with `aria-checked`: arrow-key
 * navigation, the roving tab stop and the group semantics all come from the
 * platform, and a hand-rolled radiogroup gets exactly those three things wrong.
 * The inputs are visually hidden; the label carries the appearance.
 */
export function SegmentedControl<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
  className,
}: {
  /** Must be unique on the page — it is what groups the radios. */
  name: string;
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset
      className={cn(
        "bg-surface-container has-[:focus-visible]:ring-focus-ring inline-flex gap-0.5 rounded-lg p-0.5 has-[:focus-visible]:ring-2",
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "text-label cursor-pointer rounded-md px-3 py-1.5 text-center transition-colors select-none",
              active
                ? "bg-surface text-ink shadow-card font-semibold"
                : "text-dim hover:text-ink",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}
