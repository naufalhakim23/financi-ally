import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { Amount, Button, Card, IconBox, usePressed } from "./core";
import { C, type Glyph } from "./tokens";

// ─── List atoms (DESIGN.md v1.0 → List rows, Empty states) ──────────────────

/**
 * Standard list row: icon box, title + subtitle, trailing amount, optional
 * chevron. The whole row is the touch target. Rows are 56px standard and 72px
 * when a conversion line is showing — never compressed below 44px.
 */
export function ListRow({
  title,
  subtitle,
  glyph,
  slot,
  amount,
  currency,
  amountTone = "flow",
  converted,
  stale = false,
  trailing,
  chevron = false,
  divider = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  glyph?: Glyph;
  slot?: number;
  amount?: number;
  currency?: string;
  amountTone?: "flow" | "neutral";
  converted?: { minor: number; currency: string };
  stale?: boolean;
  trailing?: React.ReactNode;
  chevron?: boolean;
  divider?: boolean;
  onPress?: () => void;
}) {
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
          <Text className="text-body-strong font-sans-semibold text-ink" numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text className="text-caption font-sans-medium text-faint" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {trailing}
        {amount != null && currency && (
          <Amount
            minor={amount}
            currency={currency}
            tone={amountTone}
            converted={converted}
            stale={stale}
          />
        )}
        {chevron && <ChevronRight size={16} color={C.chevron} strokeWidth={1.75} />}
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

/** Placeholder block for content still loading. Sized by the caller. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <View className={`bg-surface-container rounded-lg ${className}`} />;
}
