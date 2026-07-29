---
version: alpha
name: Financi-Ally
description: Offline-first personal expense & budget tracker — double-entry ledger, multi-currency, mobile (iOS + Android).

colors:
  # Brand — neutral primary (green reserved for positive semantics only)
  primary: "#1A1F2E"
  on-primary: "#FFFFFF"
  secondary: "#EEF0F6"
  on-secondary: "#1A1F2E"

  # Surfaces
  background: "#F2F3F7"
  on-background: "#1A1F2E"
  surface: "#FFFFFF"
  on-surface: "#1A1F2E"
  surface-container: "#F0F1F6"
  surface-container-high: "#E8EAF2"

  # Lines & low-emphasis
  outline: "#E2E6F0"
  outline-variant: "#F0F1F6"
  chevron: "#C0C7DA"

  # Status (semantic — never decorative)
  success: "#16A34A"
  on-success: "#FFFFFF"
  warning: "#D97706"
  on-warning: "#FFFFFF"
  error: "#DC2626"
  on-error: "#FFFFFF"
  info: "#2563EB"
  on-info: "#FFFFFF"

typography:
  sans-regular:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  sans-medium:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
  sans-semibold:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.45
  sans-bold:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.4
  mono-regular:
    fontFamily: JetBrainsMono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  mono-bold:
    fontFamily: JetBrainsMono
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.4

rounded:
  none: 0
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 20px
  full: 9999px

spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  gutter: 16px
  margin: 24px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.sans-bold}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.sans-semibold}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  button-destructive:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.error}"
    typography: "{typography.sans-semibold}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.lg}"
  input-field:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.sans-medium}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  badge:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    typography: "{typography.sans-semibold}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
---

# DESIGN.md — Financi-Ally

> Single source of truth for Financi-Ally's mobile visual identity (iOS + Android).
> AI coding agents read this file before generating any UI. Tokens above are normative.

## Overview

Financi-Ally is an offline-first personal expense & budget tracker built on a double-entry ledger with multi-currency support. The UI should feel like a calm, trustworthy financial tool — closer to a private banking statement than a gamified spending app. Restraint is the aesthetic: generous whitespace, monospaced numerals that line up, and color used surgically to signal meaning (positive/negative/warning) rather than to decorate.

**Personality**: precise, calm, trustworthy

**Audience**: an individual managing personal finances across accounts and currencies — frequently the base currency is IDR, with foreign-currency accounts converted to base for a unified net worth

**Style direction**: Editorial minimalism with financial-services calm — tonal surfaces, hairline borders, one neutral primary, semantic color only

## Colors

The palette is intentionally quiet so the numbers do the talking. A near-black neutral (`primary`) carries every structural action — primary buttons, tab-active, FAB — so the eye never mistakes a brand flourish for a semantic signal. Green appears **only** on income/gains; red **only** on expenses/losses; amber **only** on budget caution. This strict separation is the single most important color rule in the system.

- **Primary** (`#1A1F2E`): primary actions, tab-active, high-emphasis text. Doubles as the `ink` text color.
- **Secondary** (`#EEF0F6`): soft neutral fills — icon-box backgrounds, quiet chips.
- **Surface** (`#FFFFFF`): cards and elevated panels.
- **On-surface** (`#1A1F2E`): primary text on any light surface.
- **Outline** (`#E2E6F0`): hairline borders and dividers. **Outline-variant** (`#F0F1F6`): in-card dividers. **Chevron** (`#C0C7DA`): low-emphasis affordance icons.

**Status colors carry semantic meaning — never use them decoratively:**

- **Success** (`#16A34A`): income, gains, "synced", under-budget progress.
- **Warning** (`#D97706`): budget at 75%+, stale exchange rate, offline-but-usable.
- **Error** (`#DC2626`): expenses, over-budget, destructive actions, validation failures.
- **Info** (`#2563EB`): transfers, inline links, neutral notifications.

## Typography

The system pairs **Outfit** for all UI text (labels, names, headings — a geometric sans with excellent small-size legibility and a contemporary, approachable feel) with **JetBrains Mono** for every numeral (amounts, rates, balances, percentages). Mono numerals are non-negotiable for money: they are tabular, so columns of figures align vertically and digits don't jump when values change.

- **UI text**: Outfit — body defaults to Medium 500, labels to SemiBold 600, headings/emphasis to Bold 700.
- **Numbers**: JetBrains Mono — Medium 500 for inline figures, Bold 700 for hero amounts and totals.
- **Section labels**: Outfit SemiBold, ALL-CAPS, wide letter-spacing, `faint` color.

Three UI weights anchor the hierarchy (400 / 500 / 600 / 700 loaded; 500 default, 700 emphasis). Reach for Mono Bold only for the most prominent amount per screen.

## Layout

Mobile-first, single-column, scrollable canvases on a tonal `background` with white `Card` panels floating inside. Content insets default to `md` (16px) horizontal; section rhythm uses `sm`–`md` gaps within a card and `md`–`lg` between sections.

- **Spacing scale**: 8px base unit; steps `xs 4`, `sm 8`, `md 16`, `lg 24`, `xl 40`, `2xl 64`. Use scale tokens before arbitrary values.
- **Rhythm**: vertical gap between cards defaults to `sm` (12px practice); gaps inside a card group default to `xs`–`sm`.
- **Containers**: full-width with `md` horizontal padding; cards span the content width.
- **App shell**: top header (title + contextual action) per screen, scrollable body, bottom tab bar with a center Add action. Safe-area insets respected on both platforms.

## Elevation & Depth

**Tonal Layers + hairline borders** — depth comes from surface tone shifts (`background` → `surface` → `surface-container`) and a 1px `outline` border, not heavy shadows. A single very soft shadow lifts primary floating affordances only (the Add button).

- Cards: white surface + 1px `outline` border + a near-invisible shadow (`0 1px 4px rgba(26,31,46,0.06)`).
- Inputs/wells: recessed — filled with `surface-container`, no border, so they read as carved-in rather than raised.
- Pressed/active states darken the surface tone; hover is not a mobile concern.

## Shapes

The shape language is **softly rounded**.

- **Buttons**: `{rounded.xl}` (16px) — confident but friendly.
- **Cards & containers**: `{rounded.2xl}` (20px) — slightly softer for grouped content.
- **Inputs & wells**: `{rounded.lg}` (12px).
- **Pills, badges, avatars, icon-boxes**: `{rounded.full}` or `{rounded.xl}` for icon tiles.
- **Hero amounts**: no container — type carries it.

Mixing rounded and sharp corners on the same surface is a smell — pick one language per view. The whole app is soft-rounded; do not introduce sharp rectangles.

## Components

### Buttons

- **Primary** — single most-important action per screen (Save Transaction, Sign in). Background `{colors.primary}`, text `{colors.on-primary}`, `{rounded.xl}`, padding `{spacing.md}`, Outfit Bold. Never green — green is reserved for positive semantics.
- **Secondary** — alternative actions (Continue with Google, Set up starter accounts). Background `{colors.surface}`, text `{colors.on-surface}`, 1px `{colors.outline}` border.
- **Destructive** — delete, remove. Background `{colors.surface}`, text `{colors.error}`, 1px red-tinted border (`#FECACA`), soft red wash (`#FFF5F5`).
- **Tertiary / link** — text-only in `{colors.info}` or `{colors.primary}`; used for "See all", "View all", inline links.

### Cards

Background `{colors.surface}`, `{rounded.2xl}`, padding `{spacing.lg}` (or none for list cards that manage their own row padding), 1px `{colors.outline}` border, soft shadow. Cards group related content; don't nest cards inside cards. List cards divide rows with `{colors.outline-variant}` hairlines.

### Input fields

Background `{colors.surface-container}` (recessed well), text `{colors.on-surface}`, `{rounded.lg}`, padding `{spacing.md}`. Label sits above using `label-md` (Outfit SemiBold) in `{colors.on-surface}`. Helper text below in `faint`. Error state colors the text `{colors.error}`.

### Badges & chips

Background `{colors.surface-container-high}`, `{rounded.full}`, padding `{spacing.xs}`, Outfit SemiBold at small size. Use status colors only for status-meaning badges.

### Progress bars

Track `{colors.surface-container-high}`, fill `{rounded.full}` 6px tall. Fill color is **semantic by ratio**: success under 75%, warning at 75–99%, error at 100%+.

### Amounts

Every money figure uses JetBrains Mono. Sign + color are automatic: `≥ 0` renders success-green with a `+`; `< 0` renders error-red with a `−`. Foreign amounts show a `≈ base` equivalent beneath in `faint`.

### Section labels

ALL-CAPS, Outfit SemiBold, wide tracking, `faint` color — the quiet structural label above each card group ("Accounts", "Recent", "July Budget").

## Do's and Don'ts

- Do reserve green strictly for positive semantics (income, under-budget, synced). A green primary button conflates "money" with "go" — don't.
- Do use one **Primary** button per screen; demote everything else.
- Do align every money figure in JetBrains Mono so columns line up.
- Do maintain WCAG AA contrast on every text-on-surface pairing.
- Don't use status colors decoratively — a red badge must mean error/expense, an amber bar must mean budget caution.
- Don't introduce hard drop-shadows; depth is tonal + hairline.
- Don't introduce new colors outside this palette without updating DESIGN.md first.
- Don't use color alone to signal state — pair with icon, text, or shape.

## Iconography

**Library**: Lucide React Native (`lucide-react-native`), already a dependency. Category/account icons use emoji inside a soft-tinted `IconBox` (the prototype's convention) for warmth and instant recognition.

| Size | Value | Use |
|---|---|---|
| Small | 12–13px | Inline with captions, status bars, table cells |
| Default | 16–20px | Buttons, headers, list affordances |
| Large | 24px | Prominent affordances |

**Rules**:
- Status icons inherit status color (success-green check, error-red X, warning-amber triangle).
- Low-emphasis affordance icons (chevrons, edit) use `{colors.chevron}` or `{colors.faint}`.
- `currentColor` where the icon follows text color.

## Tone & Voice

- **Voice**: precise, calm, encouraging-but-not-cheerful. Suitable for money.
- **Person**: 2nd person ("you") for guidance; neutral for labels.
- **Sentence case** for buttons and labels ("Save transaction", not "SAVE").
- **Helper text**: lowercase sentence, no period — "offline · using cached rates".
- **Error text**: imperative + corrective — "Enter a valid amount".
- **Amounts**: always signed and colored; never bare.
- Multilingual: English first; amounts locale-aware via the money util (IDR base typical).

## Responsive Behavior

Phone-only (no tablet layout yet). Single column at all widths. Safe-area insets drive top/bottom padding; the bottom tab bar clears the home indicator. No two-pane layouts.

## Accessibility

- WCAG AA contrast on every text-on-surface pairing in the palette (ink/dim/faint on surface and background; on-primary on primary).
- Focus / active states visible; touch targets ≥ 44×44 CSS px (buttons, list rows, icon-boxes).
- Amount color is paired with an explicit `+`/`−` sign — color is never the only signal.
- Status badges pair color with icon or text.
- Respect `prefers-reduced-motion` (progress bar / active-state transitions are short and non-essential).

## Open Gaps

| Gap | Canon | Current | Priority |
|---|---|---|---|
| Center FAB in bottom tab bar (prototype Add affordance) | FAB+ center tab | Dashboard "New entry" primary button | Med |
| Accounts / Ledger-detail / Currencies screens | Prototype designed | Not yet built (out of this pass) | Med |
| Dark mode tokens | `userInterfaceStyle: automatic` set | Light-only tokens defined | Low |
| Platform-adaptive chrome | Unified look | Unified (iOS-flavored on both) | Low |

---

**Last updated**: 2026-07-28
**How AI agents should read this**: tokens above are normative — use them verbatim. Prose is rationale — it answers "why" so judgment calls during implementation match the brand's intent. When prose and tokens disagree, tokens win.
