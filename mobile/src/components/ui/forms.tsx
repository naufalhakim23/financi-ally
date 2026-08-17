import { forwardRef, useState } from "react";
import {
  Pressable,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { ChevronDown, Delete, Eye, EyeOff } from "lucide-react-native";

import { Chip, groupDigits, usePressed } from "./core";
import { ListRow } from "./lists";
import { Sheet } from "./overlays";
import { ICON, useTheme } from "./tokens";
import { KEYPAD_KEYS, type KeypadKey, applyKey } from "../../lib/keypad";

export { applyKey, type KeypadKey };

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

export const Field = forwardRef<TextInput, {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string | null;
  keyboardType?: "default" | "email-address" | "number-pad";
  autoCap?: "none" | "sentences" | "characters";
  secure?: boolean;
  /** Lets the OS password manager and SMS/email autofill recognise the field. */
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  returnKeyType?: TextInputProps["returnKeyType"];
  /** Fired by the keyboard's return key — wire it to the next field or submit. */
  onSubmit?: () => void;
  autoFocus?: boolean;
  maxLength?: number;
  editable?: boolean;
}>(function Field(
  {
    label,
    value,
    onChange,
    placeholder,
    helper,
    error,
    keyboardType,
    autoCap,
    secure,
    autoComplete,
    textContentType,
    returnKeyType,
    onSubmit,
    autoFocus,
    maxLength,
    editable = true,
  },
  ref,
) {
  const { C } = useTheme();
  // Reveal is per-field local state and resets on unmount, so a password is
  // never left visible across a navigation.
  const [revealed, setRevealed] = useState(false);
  const hidden = !!secure && !revealed;

  return (
    <FieldShell label={label} helper={helper} error={error}>
      <View
        className={`flex-row items-center bg-surface-container rounded-lg pl-4 min-h-touch ${
          secure ? "pr-1" : "pr-4"
        } ${error ? "border border-error-edge" : ""}`}
      >
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.disabled}
          keyboardType={keyboardType}
          autoCapitalize={autoCap}
          // A password manager can't fill a field it can't identify, so these
          // are as important as the keyboard type.
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCorrect={false}
          secureTextEntry={hidden}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmit}
          // Without this the keyboard closes on return before the next field
          // can take focus, and the form flickers shut between every entry.
          blurOnSubmit={!onSubmit}
          autoFocus={autoFocus}
          maxLength={maxLength}
          editable={editable}
          accessibilityLabel={label}
          aria-invalid={!!error}
          className={`flex-1 py-3 text-body font-sans-medium ${
            error ? "text-error" : editable ? "text-ink" : "text-dim"
          }`}
        />
        {secure && (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            accessibilityState={{ selected: revealed }}
            // 44px target: the icon is 20px, the padding carries the rest.
            className="w-11 h-11 items-center justify-center"
            hitSlop={4}
          >
            {revealed ? (
              <EyeOff size={ICON.xl} color={C.dim} strokeWidth={1.75} />
            ) : (
              <Eye size={ICON.xl} color={C.dim} strokeWidth={1.75} />
            )}
          </Pressable>
        )}
      </View>
    </FieldShell>
  );
});

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
  const { C } = useTheme();
  // The field shows separators but the caller keeps the raw decimal string, so
  // toMinor() never has to know about display formatting.
  const [intPart, frac] = value.split(".");
  const display = frac === undefined ? groupDigits(intPart ?? "") : `${groupDigits(intPart ?? "")}.${frac}`;
  return (
    <FieldShell label={label} helper={helper} error={error}>
      <View
        className={`flex-row items-center bg-surface-container rounded-lg px-4 py-3 min-h-touch ${
          error ? "border border-error-edge" : ""
        }`}
      >
        <Text className="text-amount font-mono-medium text-faint mr-2">{currency}</Text>
        <TextInput
          value={display}
          onChangeText={(t) => onChange(t.replace(/,/g, ""))}
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
  const { C } = useTheme();
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
        <ChevronDown size={ICON.lg} color={C.chevron} strokeWidth={1.75} />
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
  const { ELEVATION } = useTheme();
  return (
    <View className="flex-row rounded-lg bg-surface-container p-track-inset">
      {options.map((o) => {
        const active = o.value === value;
        const tone = o.tone ?? "neutral";
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`flex-1 py-2.5 items-center ${active ? "bg-surface" : ""}`}
            // The thumb sits 2px inside the track, so its radius is the track's
            // less the padding — there is no token for a derived inner radius.
            style={active ? [{ borderRadius: 10 }, ELEVATION.card] : undefined}
          >
            <Text
              className={`text-body-strong font-sans-semibold ${
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

/**
 * The amount under entry, shown as a recessed well rather than a text field.
 * RN has no inset shadow, so the recess is carried by the tonal step alone
 * (`surface-container` inside a `surface` sheet) — which is the depth model
 * DESIGN.md picked anyway.
 */
export function AmountWell({
  currency,
  display,
  helper,
  onPressCurrency,
}: {
  currency: string;
  /** Already grouped for display — the keypad owns the raw digits. */
  display: string;
  helper?: string;
  onPressCurrency?: () => void;
}) {
  const { C } = useTheme();
  return (
    <View className="bg-surface-container rounded-lg px-4 py-4 items-center" style={{ gap: 6 }}>
      <Pressable
        onPress={onPressCurrency}
        disabled={!onPressCurrency}
        accessibilityRole={onPressCurrency ? "button" : undefined}
        accessibilityLabel={`Currency ${currency}`}
        className="flex-row items-center"
        style={{ gap: 4 }}
      >
        <Text className="text-label font-sans-semibold text-dim">{currency}</Text>
        {onPressCurrency && <ChevronDown size={13} color={C.dim} strokeWidth={2} />}
      </Pressable>
      <Text className="text-amount-hero font-mono-bold text-ink">{display || "0"}</Text>
      {helper && <Text className="text-mono-meta font-mono text-faint">{helper}</Text>}
    </View>
  );
}

/**
 * Numeric keypad for the add sheet. Custom rather than the OS keyboard so the
 * amount, the pickers and the keys stay on one surface — the sheet never has to
 * fight a keyboard for the bottom of the screen.
 */
export function Keypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {KEYPAD_KEYS.map((k) => (
        <KeypadButton key={k} value={k} onPress={() => onKey(k)} />
      ))}
    </View>
  );
}

function KeypadButton({ value, onPress }: { value: KeypadKey; onPress: () => void }) {
  const { C } = useTheme();
  const { pressed, handlers } = usePressed();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value === "back" ? "Delete last digit" : value}
      {...handlers}
      className={`rounded-lg items-center justify-center py-3.5 ${
        pressed ? "bg-surface-container-high" : "bg-surface-container"
      }`}
      // Three per row with two 8px gaps between them.
      style={{ width: "31.5%", minHeight: 52 }}
    >
      {value === "back" ? (
        <Delete size={22} color={C.dim} strokeWidth={1.75} />
      ) : (
        <Text
          className={
            value === "000"
              ? "text-body-lg font-mono-medium text-dim"
              : "text-amount-lg font-mono-bold text-ink"
          }
        >
          {value}
        </Text>
      )}
    </Pressable>
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
  const { C } = useTheme();
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
