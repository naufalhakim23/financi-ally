import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { Pressable } from "react-native";

import { useTheme } from "./ui";

/**
 * The shell every unauthenticated screen sits in: safe area, the keyboard
 * dodge, a centred scroll body, the wordmark and a caption.
 *
 * These four screens drew this by hand and drifted — welcome had no safe area,
 * login and register got the navigator's stock header while every screen inside
 * the app draws its own. One shell is what keeps them identical.
 */
export function AuthScreen({
  caption,
  onBack,
  children,
  footer,
}: {
  /** The line under the wordmark; says what this screen is for. */
  caption: string;
  /**
   * Where Back goes. Authoritative, not a fallback: these screens navigate with
   * `replace`, so the history stack does not describe the flow. Omit on
   * first-run screens to hide the affordance.
   */
  onBack?: () => void;
  children: React.ReactNode;
  /** Fine print pinned under the form — terms, reassurance, a hint. */
  footer?: React.ReactNode;
}) {
  const { C } = useTheme();

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* Reserves its height whether or not there is a back affordance, so
            the wordmark sits at the same offset on every screen. */}
        <View className="h-11 justify-center px-2">
          {onBack && (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="flex-row items-center self-start min-h-touch px-2"
              hitSlop={4}
            >
              <ChevronLeft size={20} color={C.info} strokeWidth={2} />
              <Text className="text-body-strong font-sans-semibold text-info ml-0.5">Back</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text
            accessibilityRole="header"
            className="text-display font-sans-bold text-ink text-center mb-1"
          >
            Financi-Ally
          </Text>
          <Text className="text-body font-sans-medium text-dim text-center mb-8">{caption}</Text>

          {children}

          {footer && <View className="mt-6">{footer}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * The inline error line above a form's submit button. Announced when it
 * appears — a sighted user sees the message land, a screen-reader user
 * otherwise gets nothing at all.
 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      role="alert"
      className="text-error text-caption font-sans-medium mb-3"
    >
      {message}
    </Text>
  );
}

/** "or" rule between the credential form and the OAuth button. */
export function OrDivider() {
  return (
    <View className="flex-row items-center my-4" style={{ gap: 12 }}>
      <View className="flex-1 h-px bg-outline" />
      <Text className="text-caption font-sans-medium text-faint">or</Text>
      <View className="flex-1 h-px bg-outline" />
    </View>
  );
}
