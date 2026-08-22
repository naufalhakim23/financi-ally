/** @type {import('tailwindcss').Config} */
// Token scale mirrors DESIGN.md v2.0 (project root). NativeWind consumes these
// as bg-*/text-*/border-*/font-* utilities. When DESIGN.md changes, change it
// here. Only SEMANTIC names live here — the raw ramps stay in DESIGN.md and in
// src/components/ui/tokens.ts for the few places that need JS values.
//
// Every color resolves through a CSS variable declared in global.css, where the
// light set lives on :root and the dark set re-points the same names. That is
// why no screen carries a `dark:` variant: switching the scheme swaps the
// variables underneath the same utility classes. The variables hold bare RGB
// channels, not hex, so `<alpha-value>` still works — the form NativeWind
// documents and tests for `darkMode: "class"`.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand — neutral primary in light, near-white in dark (see global.css)
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-pressed": "rgb(var(--primary-pressed) / <alpha-value>)",
        "on-primary": "rgb(var(--on-primary) / <alpha-value>)",
        secondary: "rgb(var(--secondary) / <alpha-value>)",
        "on-secondary": "rgb(var(--on-secondary) / <alpha-value>)",

        // Accent (v2.0 sea-glass) — chrome punctuation only, never on amounts.
        // White text sits on accent-strong; the base fill is glyph-contrast only.
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-strong": "rgb(var(--accent-strong) / <alpha-value>)",
        "accent-pressed": "rgb(var(--accent-pressed) / <alpha-value>)",
        "accent-wash": "rgb(var(--accent-wash) / <alpha-value>)",
        "accent-edge": "rgb(var(--accent-edge) / <alpha-value>)",
        "on-accent": "rgb(var(--on-accent) / <alpha-value>)",

        // Surfaces (tonal ladder, low → high)
        background: "rgb(var(--background) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-container": "rgb(var(--surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--surface-container-high) / <alpha-value>)",
        "surface-pressed": "rgb(var(--surface-pressed) / <alpha-value>)",

        // Text roles
        ink: "rgb(var(--ink) / <alpha-value>)",
        dim: "rgb(var(--dim) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        disabled: "rgb(var(--disabled) / <alpha-value>)",
        "on-inverse": "rgb(var(--on-inverse) / <alpha-value>)",

        // Lines & low-emphasis
        outline: "rgb(var(--outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--outline-variant) / <alpha-value>)",
        "outline-strong": "rgb(var(--outline-strong) / <alpha-value>)",
        chevron: "rgb(var(--chevron) / <alpha-value>)",
        "focus-ring": "rgb(var(--focus-ring) / <alpha-value>)",

        // Status — semantic only. Each hue is base / wash (fill) / edge (border)
        // / strong (the text-on-surface variant, darker in light, same in dark).
        success: "rgb(var(--success) / <alpha-value>)",
        "success-wash": "rgb(var(--success-wash) / <alpha-value>)",
        "success-edge": "rgb(var(--success-edge) / <alpha-value>)",
        "success-strong": "rgb(var(--success-strong) / <alpha-value>)",
        "on-success": "rgb(var(--on-success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        "warning-wash": "rgb(var(--warning-wash) / <alpha-value>)",
        "warning-edge": "rgb(var(--warning-edge) / <alpha-value>)",
        "warning-strong": "rgb(var(--warning-strong) / <alpha-value>)",
        "on-warning": "rgb(var(--on-warning) / <alpha-value>)",
        error: "rgb(var(--error) / <alpha-value>)",
        "error-wash": "rgb(var(--error-wash) / <alpha-value>)",
        "error-edge": "rgb(var(--error-edge) / <alpha-value>)",
        "error-strong": "rgb(var(--error-strong) / <alpha-value>)",
        "on-error": "rgb(var(--on-error) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
        "info-wash": "rgb(var(--info-wash) / <alpha-value>)",
        "info-edge": "rgb(var(--info-edge) / <alpha-value>)",
        "info-strong": "rgb(var(--info-strong) / <alpha-value>)",
        "on-info": "rgb(var(--on-info) / <alpha-value>)",
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
        // v2.0: one step softer — buttons/inputs xl, cards/sheets 2xl, icon
        // tiles their own step.
        sm: "6px",
        md: "8px",
        lg: "12px",
        tile: "14px",
        xl: "18px",
        "2xl": "24px",
      },
      spacing: {
        // Named density steps from DESIGN.md → Layout & density.
        "card-gap": "12px",
        touch: "44px",
        row: "56px",
        "row-fx": "72px",
        // Text column of a glyph row (16 padding + 36 glyph + 16 gap): dividers
        // and nested rows start under the label, not the icon.
        "row-inset": "68px",
        // Segmented-control track padding, off the 4px scale so the thumb keeps
        // a hairline of track around it rather than a gap.
        "track-inset": "3px",
      },
    },
  },
  plugins: [],
};
