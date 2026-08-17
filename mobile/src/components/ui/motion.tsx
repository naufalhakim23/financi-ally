import { Pressable } from "react-native";
import Animated from "react-native-reanimated";

// DESIGN.md press-scale token. Discrete affordances only, not full-width rows.
export const PRESS_SCALE = 0.97;

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
