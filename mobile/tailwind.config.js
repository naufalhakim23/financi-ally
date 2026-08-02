/** @type {import('tailwindcss').Config} */
// Token scale mirrors DESIGN.md v1.0 (project root). NativeWind consumes these
// as bg-*/text-*/border-*/font-* utilities. When DESIGN.md changes, change it
// here. Only SEMANTIC names live here — the raw ramps stay in DESIGN.md and in
// src/components/ui/tokens.ts for the few places that need JS values.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand — neutral primary; green is positive-only (see DESIGN.md)
        primary: "#1A1F2E",
        "primary-pressed": "#2A3140",
        "on-primary": "#FFFFFF",
        secondary: "#EEF0F6",
        "on-secondary": "#1A1F2E",

        // Surfaces (tonal ladder, low → high)
        background: "#F2F3F7",
        surface: "#FFFFFF",
        "surface-container": "#F0F1F6",
        "surface-container-high": "#E8EAF2",
        "surface-pressed": "#EEF0F6",

        // Text roles
        ink: "#1A1F2E",
        dim: "#5A6379",
        faint: "#737C91",
        disabled: "#98A1B5",
        "on-inverse": "#F7F8FB",

        // Lines & low-emphasis
        outline: "#E2E6F0",
        "outline-variant": "#F0F1F6",
        "outline-strong": "#C0C7DA",
        chevron: "#C0C7DA",
        "focus-ring": "#2563EB",

        // Status — semantic only. Each hue is base / wash (fill) / edge (border).
        success: "#16A34A",
        "success-wash": "#ECFDF3",
        "success-edge": "#BBF7D0",
        "on-success": "#FFFFFF",
        warning: "#D97706",
        "warning-wash": "#FFFBEB",
        "warning-edge": "#FDE68A",
        "on-warning": "#FFFFFF",
        error: "#DC2626",
        "error-wash": "#FEF2F2",
        "error-edge": "#FECACA",
        "on-error": "#FFFFFF",
        info: "#2563EB",
        "info-wash": "#EFF6FF",
        "info-edge": "#BFDBFE",
        "on-info": "#FFFFFF",
      },
      // Type roles carry size + line-height + tracking. Weight comes from the
      // font family (font-sans-semibold etc.) so the loaded Outfit/JetBrains
      // variants render rather than being synthesized.
      fontSize: {
        "display-xl": ["40px", { lineHeight: "42px", letterSpacing: "-0.8px" }],
        display: ["32px", { lineHeight: "35px", letterSpacing: "-0.64px" }],
        title: ["24px", { lineHeight: "30px", letterSpacing: "-0.24px" }],
        headline: ["20px", { lineHeight: "26px", letterSpacing: "-0.2px" }],
        "body-lg": ["17px", { lineHeight: "26px" }],
        body: ["15px", { lineHeight: "23px" }],
        "body-strong": ["15px", { lineHeight: "22px" }],
        label: ["13px", { lineHeight: "18px" }],
        caption: ["12px", { lineHeight: "16px" }],
        overline: ["11px", { lineHeight: "13px", letterSpacing: "0.88px" }],
        "amount-hero": ["34px", { lineHeight: "34px", letterSpacing: "-0.68px" }],
        "amount-lg": ["22px", { lineHeight: "24px", letterSpacing: "-0.22px" }],
        amount: ["15px", { lineHeight: "21px" }],
        "amount-sm": ["13px", { lineHeight: "18px" }],
        "mono-meta": ["11px", { lineHeight: "15px" }],
      },
      fontFamily: {
        // Family names match the keys registered in app/_layout.tsx useFonts().
        // `mono*` is face-agnostic on purpose — DESIGN.md owns which numeral face
        // is loaded (IBM Plex Mono as of v1.1), so a swap never touches call sites.
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
      spacing: {
        // Named density steps from DESIGN.md → Layout & density.
        "card-gap": "12px",
        touch: "44px",
        row: "56px",
        "row-fx": "72px",
      },
    },
  },
  plugins: [],
};
