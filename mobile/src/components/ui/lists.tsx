import { Pressable, Text, View } from "react-native";
import { ArrowLeftRight, ChevronRight, Plus, TriangleAlert } from "lucide-react-native";

import { Amount, Button, Card, IconBox, usePressed } from "./core";
import { useTheme, type Glyph } from "./tokens";

// ─── List atoms (DESIGN.md v1.0 → List rows, Empty states) ──────────────────

/**
 * Standard list row: icon box, title + subtitle, trailing amount, optional
 * chevron. The whole row is the touch target. Rows are 56px standard and 72px
 * when a conversion line is showing — never compressed below 44px.
 */
export function ListRow({
  title,
  titleSize = "md",
  subtitle,
  subtitleTone = "faint",
  subtitleGlyph: S,
  glyph,
  slot,
  amount,
  currency,
  amountSize = "md",
  amountTone = "flow",
  converted,
  meta,
  stale = false,
  trailing,
  chevron = false,
  chevronGlyph: Chev = ChevronRight,
  divider = false,
  onPress,
}: {
  title: string;
  titleSize?: "md" | "lg";
  subtitle?: string;
  /** A subtitle that carries a caution (a stale rate, an unsynced write). */
  subtitleTone?: "faint" | "warning";
  subtitleGlyph?: Glyph;
  glyph?: Glyph;
  slot?: number;
  amount?: number;
  currency?: string;
  amountSize?: "hero" | "lg" | "md" | "sm";
  amountTone?: "flow" | "neutral";
  converted?: { minor: number; currency: string };
  /** Mono footnote under the amount — a running balance, a native-currency split. */
  meta?: string;
  stale?: boolean;
  trailing?: React.ReactNode;
  chevron?: boolean;
  /** Swap the chevron's direction, e.g. to show an expanded bucket. */
  chevronGlyph?: Glyph;
  divider?: boolean;
  onPress?: () => void;
}) {
  const { C } = useTheme();
  const { pressed, handlers } = usePressed();
  const tall = converted != null;

  return (
    <View>
      {/* Hairline is inset to the text column when rows carry an icon box, so
          the divider reads as separating content rather than slicing the card. */}
      {divider && (
        <View className={`h-px bg-outline-variant ${glyph ? "ml-[68px]" : "ml-4"}`} />
      )}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        {...handlers}
        className={`flex-row items-center gap-card-gap px-4 py-3 ${
          tall ? "min-h-row-fx" : "min-h-row"
        } ${pressed && onPress ? "bg-surface-pressed" : ""}`}
      >
        {glyph && <IconBox glyph={glyph} slot={slot} />}
        <View className="flex-1 min-w-0">
          <Text
            className={`${titleSize === "lg" ? "text-body-lg" : "text-body-strong"} font-sans-semibold text-ink`}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <View className="flex-row items-center" style={{ gap: 5 }}>
              {S && <S size={12} color={subtitleTone === "warning" ? C.warning : C.faint} strokeWidth={2} />}
              <Text
                className={`text-caption font-sans-medium ${
                  subtitleTone === "warning" ? "text-warning" : "text-faint"
                }`}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          )}
        </View>
        {trailing}
        {amount != null && currency && (
          <View className="items-end">
            <Amount
              minor={amount}
              currency={currency}
              size={amountSize}
              tone={amountTone}
              converted={converted}
              stale={stale}
            />
            {meta && <Text className="text-mono-meta font-mono text-faint">{meta}</Text>}
          </View>
        )}
        {chevron && <Chev size={18} color={C.chevron} strokeWidth={1.75} />}
      </Pressable>
    </View>
  );
}

/**
 * What a surface shows when it has nothing yet. Always says what will appear
 * and, where there is one, offers the action that fills it — a bare "no data"
 * line leaves a new user stuck. Lucide glyph, no illustration.
 */
export function EmptyState({
  glyph: G,
  title,
  body,
  actionLabel,
  onAction,
}: {
  glyph: Glyph;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { C } = useTheme();
  return (
    <Card>
      <View className="items-center py-3">
        <G size={24} color={C.disabled} strokeWidth={1.75} />
        <Text className="text-ink text-body-strong font-sans-semibold text-center mt-3">
          {title}
        </Text>
        {body && (
          <Text className="text-dim text-body font-sans-medium text-center mt-1">{body}</Text>
        )}
        {actionLabel && onAction && (
          <View className="mt-3">
            <Button label={actionLabel} onPress={onAction} variant="tertiary" />
          </View>
        )}
      </View>
    </Card>
  );
}

/**
 * A server read that failed. Distinct from EmptyState: empty means "nothing
 * here yet", this means "we don't know what's here" — so it must offer the
 * retry rather than leave the screen looking authoritatively blank.
 */
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { C } = useTheme();
  return (
    <Card>
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <TriangleAlert size={18} color={C.warning} strokeWidth={1.75} />
        <View className="flex-1">
          <Text
            className="text-body font-sans-medium text-ink"
            accessibilityLiveRegion="polite"
            role="alert"
          >
            {message}
          </Text>
          {onRetry && (
            <View className="mt-1 -ml-2 self-start">
              <Button label="Try again" variant="tertiary" onPress={onRetry} />
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

/**
 * 36px bordered affordance that lives at the end of a row. Small on purpose —
 * the row itself is the primary target, these are the secondary verbs.
 */
export function RowAction({
  glyph: G,
  label,
  onPress,
  tone = "neutral",
}: {
  glyph: Glyph;
  label: string;
  onPress: () => void;
  /** `info` marks a move: shifting money between pockets is not spending. */
  tone?: "neutral" | "info";
}) {
  const { C } = useTheme();
  const { pressed, handlers } = usePressed();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...handlers}
      className={`w-9 h-9 rounded-xl border border-outline items-center justify-center ${
        pressed ? (tone === "info" ? "bg-info-wash" : "bg-surface-pressed") : "bg-surface"
      }`}
    >
      <G size={17} color={tone === "info" ? C.info : C.ink} strokeWidth={1.75} />
    </Pressable>
  );
}

/**
 * A child inside an expanded bucket. Indented to the parent's text column so
 * the tree reads as a tree, with its own add / move affordances.
 */
export function BucketChildRow({
  name,
  meta,
  onPress,
  onAdd,
  onMove,
  divider = true,
}: {
  name: string;
  meta: string;
  onPress?: () => void;
  onAdd?: () => void;
  onMove?: () => void;
  divider?: boolean;
}) {
  const { pressed, handlers } = usePressed();
  return (
    <View>
      {divider && <View className="h-px bg-outline-variant ml-[68px]" />}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        {...handlers}
        className={`flex-row items-center pl-[68px] pr-4 py-2.5 ${
          pressed && onPress ? "bg-surface-pressed" : ""
        }`}
        style={{ gap: 10 }}
      >
        <View className="flex-1 min-w-0">
          <Text className="text-body font-sans-medium text-ink" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-mono-meta font-mono text-faint">{meta}</Text>
        </View>
        {onAdd && <RowAction glyph={Plus} label={`Add to ${name}`} onPress={onAdd} />}
        {onMove && (
          <RowAction glyph={ArrowLeftRight} label={`Move money in ${name}`} onPress={onMove} tone="info" />
        )}
      </Pressable>
    </View>
  );
}

/** Day or period divider above a group of ledger rows, with that group's net. */
export function DayHeader({ label, total }: { label: string; total?: string }) {
  return (
    <View className="flex-row items-baseline justify-between px-1">
      <Text className="text-overline font-sans-semibold text-faint uppercase">{label}</Text>
      {total && <Text className="text-mono-meta font-mono text-faint">{total}</Text>}
    </View>
  );
}

/** Placeholder block for content still loading. Sized by the caller. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <View className={`bg-surface-container rounded-lg ${className}`} />;
}
