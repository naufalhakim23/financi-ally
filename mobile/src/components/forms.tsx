import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

// Shared form primitives for the auth screens. Small enough to stay in one
// file until M3's atomic component library lands.

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
      <Text className="text-sm font-semibold text-gray-700 mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCap}
        secureTextEntry={secure}
        className="border border-gray-300 rounded-lg px-4 py-3 text-base"
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
      className="bg-black rounded-lg py-4 items-center disabled:opacity-50"
    >
      {busy ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">{label}</Text>}
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
      className="border border-gray-300 rounded-lg py-4 items-center disabled:opacity-50"
    >
      {busy ? <ActivityIndicator /> : <Text className="font-semibold text-gray-800">{label}</Text>}
    </Pressable>
  );
}
