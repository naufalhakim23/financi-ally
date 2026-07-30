import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

// Shared form primitives, token-driven (DESIGN.md). Auth + entry screens share
// these, so restyling here reskins every form surface. Named font families
// (font-sans-semibold etc.) are used instead of font-weight utilities so the
// loaded Outfit variants render crisply rather than synthesized.

// AmountField: numeric entry for a money amount. Wire format is integer minor
// units; this field works in display (decimal) form and converts via
// money.toMinor at the boundary.
export function AmountField({
  label,
  value,
  onChange,
  currency,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  currency: string;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-sans-semibold text-dim mb-1">{label}</Text>
      <View className="flex-row items-center bg-surface-container rounded-lg px-4 py-3">
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="0"
          keyboardType="decimal-pad"
          className="flex-1 text-2xl font-mono-bold text-ink"
          placeholderTextColor="#9EA6BE"
        />
        <Text className="text-faint font-mono-medium ml-2">{currency}</Text>
      </View>
    </View>
  );
}

// Picker: a horizontal wrap of options (one selected). A dropdown lib is
// overkill for a handful of account/category choices.
export function Picker<T extends string>({
  label,
  value,
  options,
  getLabel,
  onSelect,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  getLabel?: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-sans-semibold text-dim mb-1">{label}</Text>
      <View className="flex-row flex-wrap">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onSelect(o.value)}
              className={`rounded-lg px-4 py-3 mr-2 mb-2 border ${
                active ? "border-primary bg-primary" : "border-outline bg-surface"
              }`}
            >
              <Text
                className={active ? "text-on-primary font-sans-semibold" : "text-ink"}
              >
                {getLabel ? getLabel(o.value) : o.label}
              </Text>
            </Pressable>
          );
        })}
        {options.length === 0 && <Text className="text-faint text-sm">None yet</Text>}
      </View>
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCap,
  secure,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address";
  autoCap?: "none" | "sentences" | "characters";
  secure?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-sans-semibold text-dim mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9EA6BE"
        keyboardType={keyboardType}
        autoCapitalize={autoCap}
        secureTextEntry={secure}
        className="bg-surface-container rounded-lg px-4 py-3 text-base text-ink font-sans-medium"
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="bg-primary rounded-xl py-4 items-center disabled:opacity-50"
    >
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className="text-on-primary font-sans-bold">{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="border border-outline bg-surface rounded-xl py-4 items-center disabled:opacity-50"
    >
      {busy ? <ActivityIndicator /> : <Text className="font-sans-semibold text-ink">{label}</Text>}
    </Pressable>
  );
}

// Destructive: delete / remove. Soft red wash, error text — never the primary
// neutral, so irreversible actions read as dangerous.
export function DestructiveButton({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="border border-error-border bg-error-soft rounded-xl py-4 items-center disabled:opacity-50"
    >
      {busy ? (
        <ActivityIndicator color="#DC2626" />
      ) : (
        <Text className="font-sans-semibold text-error">{label}</Text>
      )}
    </Pressable>
  );
}
