import { useState } from "react";
import { Pressable, Switch as RNSwitch, Text, TextInput, View } from "react-native";
import { ChevronDown } from "lucide-react-native";

import { Chip, usePressed } from "./core";
import { ListRow } from "./lists";
import { Sheet } from "./overlays";
import { C } from "./tokens";

// ─── Form atoms (DESIGN.md v1.0 → Input fields, Selects, switches) ──────────
// Inputs are recessed wells: surface-container fill, no border, so they read as
// carved-in rather than raised. Label above, helper/error below.

/** Label + optional helper/error text wrapper shared by every field. */
function FieldShell({
  label,
  helper,
  error,
  children,
}: {
  label?: string;
  helper?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      {label && (
        <Text className="text-label font-sans-semibold text-ink mb-1.5">{label}</Text>
      )}
      {children}
      {(error || helper) && (
        <Text
          className={`text-caption font-sans-medium mt-1 ${error ? "text-error" : "text-faint"}`}
        >
          {error || helper}
        </Text>
      )}
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  helper,
  error,
  keyboardType,
  autoCap,
  secure,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string | null;
  keyboardType?: "default" | "email-address";
  autoCap?: "none" | "sentences" | "characters";
  secure?: boolean;
}) {
  return (
    <FieldShell label={label} helper={helper} error={error}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.disabled}
        keyboardType={keyboardType}
        autoCapitalize={autoCap}
        secureTextEntry={secure}
        accessibilityLabel={label}
        aria-invalid={!!error}
        className={`bg-surface-container rounded-lg px-4 py-3 min-h-touch text-body font-sans-medium ${
          error ? "border border-error-edge text-error" : "text-ink"
        }`}
      />
    </FieldShell>
  );
}

/**
 * Numeric entry for a money amount. Mono, right-aligned, currency code as a
 * faint prefix. Wire format is integer minor units; this field works in display
 * (decimal) form and converts via money.toMinor at the boundary.
 */
export function AmountField({
  label,
  value,
  onChange,
  currency,
  helper,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  currency: string;
  helper?: string;
  error?: string | null;
}) {
  return (
    <FieldShell label={label} helper={helper} error={error}>
      <View
        className={`flex-row items-center bg-surface-container rounded-lg px-4 py-3 min-h-touch ${
          error ? "border border-error-edge" : ""
        }`}
      >
        <Text className="text-amount font-mono-medium text-faint mr-2">{currency}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="0"
          keyboardType="decimal-pad"
          placeholderTextColor={C.disabled}
          accessibilityLabel={label}
          textAlign="right"
          className="flex-1 text-amount-lg font-mono-bold text-ink"
        />
      </View>
    </FieldShell>
  );
}

/**
 * Select. An input well that opens a bottom sheet — never a native dropdown,
 * which renders differently on each platform and breaks the calm.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  placeholder = "Choose",
  helper,
  error,
  onSelect,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string; subtitle?: string }[];
  placeholder?: string;
  helper?: string;
  error?: string | null;
  onSelect: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const { pressed, handlers } = usePressed();
  const selected = options.find((o) => o.value === value);

  return (
    <FieldShell label={label} helper={helper} error={error}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        {...handlers}
        className={`flex-row items-center justify-between rounded-lg px-4 py-3 min-h-touch ${
          pressed ? "bg-surface-pressed" : "bg-surface-container"
        } ${error ? "border border-error-edge" : ""}`}
      >
        <Text
          className={`text-body font-sans-medium ${selected ? "text-ink" : "text-disabled"}`}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={C.chevron} strokeWidth={1.75} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.length === 0 ? (
          <Text className="text-body font-sans-medium text-faint py-4">Nothing to choose yet</Text>
        ) : (
          options.map((o, i) => (
            <ListRow
              key={o.value}
              title={o.label}
              subtitle={o.subtitle}
              divider={i > 0}
              chevron={false}
              onPress={() => {
                onSelect(o.value);
                setOpen(false);
              }}
              trailing={
                o.value === value ? (
                  <Text className="text-label font-sans-semibold text-info">Selected</Text>
                ) : undefined
              }
            />
          ))
        )}
      </Sheet>
    </FieldShell>
  );
}

/**
 * Horizontal wrap of filter chips (one selected). For a handful of choices this
 * beats a Select: every option is visible and one tap away.
 */
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  helper,
  error,
  emptyText = "None yet",
  onSelect,
}: {
  label?: string;
  value: T | null;
  options: { value: T; label: string }[];
  helper?: string;
  error?: string | null;
  emptyText?: string;
  onSelect: (v: T) => void;
}) {
  return (
    <FieldShell label={label} helper={helper} error={error}>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={o.value === value}
            onPress={() => onSelect(o.value)}
          />
        ))}
        {options.length === 0 && (
          <Text className="text-body font-sans-medium text-faint">{emptyText}</Text>
        )}
      </View>
    </FieldShell>
  );
}

type SegTone = "neutral" | "success" | "error" | "info";
const SEG_ACTIVE_TEXT: Record<SegTone, string> = {
  neutral: "text-ink",
  success: "text-success",
  error: "text-error",
  info: "text-info",
};

/** Segmented control: recessed track, raised active thumb. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; tone?: SegTone }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row rounded-full bg-surface-container p-1" style={{ gap: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        const tone = o.tone ?? "neutral";
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`flex-1 py-2 rounded-full items-center ${active ? "bg-surface" : ""}`}
          >
            <Text
              className={`text-label font-sans-semibold ${
                active ? SEG_ACTIVE_TEXT[tone] : "text-faint"
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Labelled switch row. Track is primary when on, container-high when off. */
export function SwitchRow({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-3 min-h-touch">
      <View className="flex-1 pr-4">
        <Text className="text-body-strong font-sans-semibold text-ink">{label}</Text>
        {helper && (
          <Text className="text-caption font-sans-medium text-faint mt-0.5">{helper}</Text>
        )}
      </View>
      <RNSwitch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: C.surfaceContainerHigh, true: C.primary }}
        thumbColor={C.surface}
      />
    </View>
  );
}
