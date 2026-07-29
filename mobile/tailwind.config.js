/** @type {import('tailwindcss').Config} */
// Token scale mirrors DESIGN.md (project root). NativeWind consumes these as
// bg-*/text-*/border-*/font-* utilities. When DESIGN.md changes, change it here.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand — neutral primary; green is positive-only (see DESIGN.md)
        primary: "#1A1F2E",
        "on-primary": "#FFFFFF",
        secondary: "#EEF0F6",
        "on-secondary": "#1A1F2E",

        // Surfaces
        background: "#F2F3F7",
        "on-background": "#1A1F2E",
        surface: "#FFFFFF",
        "on-surface": "#1A1F2E",
        "surface-container": "#F0F1F6",
        "surface-container-high": "#E8EAF2",

        // Lines & low-emphasis
        outline: "#E2E6F0",
        "outline-variant": "#F0F1F6",
        chevron: "#C0C7DA",

        // Text
        ink: "#1A1F2E",
        dim: "#6B738E",
        faint: "#9EA6BE",

        // Status (semantic only)
        success: "#16A34A",
        warning: "#D97706",
        error: "#DC2626",
        info: "#2563EB",

        // Soft semantic tints (selected / wash states)
        "success-soft": "#E8F5EE",
        "success-border": "#A7D8B8",
        "warning-soft": "#FFFBEB",
        "warning-border": "#FDE68A",
        "error-soft": "#FFF5F5",
        "error-border": "#FECACA",
        "info-soft": "#EFF4FF",
      },
      fontFamily: {
        // Family names match the keys registered in app/_layout.tsx useFonts().
        sans: "Outfit",
        "sans-medium": "Outfit-Medium",
        "sans-semibold": "Outfit-SemiBold",
        "sans-bold": "Outfit-Bold",
        mono: "Mono",
        "mono-medium": "Mono-Medium",
        "mono-bold": "Mono-Bold",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};
