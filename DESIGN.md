---
version: 2.0
name: Financi-Ally
description: Offline-first personal expense & budget tracker — double-entry ledger, multi-currency, mobile (iOS + Android).
supersedes: DESIGN.md alpha, v1.0 (JetBrains Mono numerals), and v1.x (cool slate ramp, chrome blue — see Retired directions). Sea-glass identity per docs/rfc/0002.

# ─────────────────────────────────────────────────────────────
# TOKENS — normative. Two layers: raw scales, then semantic
# aliases. UI code references SEMANTIC names only.
# ─────────────────────────────────────────────────────────────

palette:
  # Neutral ramp (single family — warm gray since v2.0; the whole UI is built from it)
  neutral-0: "#FFFFFF"
  neutral-50: "#FAF9F7"
  neutral-100: "#F6F5F3"
  neutral-150: "#F1EFEC"
  neutral-175: "#EFEDE9"
  neutral-200: "#E8E5E0"
  neutral-250: "#E5E2DD"
  neutral-300: "#CFCBC4"
  neutral-400: "#A8A29A"
  neutral-500: "#726C64"
  neutral-600: "#5D5952"
  neutral-800: "#38342E"
  neutral-900: "#201E1B"
  neutral-950: "#151311"
  # Accent (sea-glass teal, v2.0) — brand punctuation, never money-semantic
  teal-500: "#0E8A7B"
  teal-600: "#0B7268"
  teal-700: "#0A675C"
  teal-050: "#EBF4F2"
  teal-edge: "#CDE4E0"
  teal-dark: "#3FB3A2"
  teal-dark-pressed: "#58C4B4"
  teal-dark-wash: "#122622"
  teal-dark-edge: "#1E413B"
  # Semantic hues — three steps each: base (marks/text), wash (fill), edge (border)
  green-600: "#15803D"
  green-500: "#16A34A"
  green-050: "#ECFDF3"
  green-edge: "#BBF7D0"
  amber-600: "#B45309"
  amber-500: "#D97706"
  amber-050: "#FFFBEB"
  amber-edge: "#FDE68A"
  red-600: "#B91C1C"
  red-500: "#DC2626"
  red-050: "#FEF2F2"
  red-edge: "#FECACA"
  blue-600: "#1D4ED8"
  blue-500: "#2563EB"
  blue-050: "#EFF6FF"
  blue-edge: "#BFDBFE"

colors:
  # Brand — neutral primary. Green is never a brand color.
  primary: "#201E1B"
  primary-pressed: "#38342E"
  on-primary: "#FFFFFF"
  secondary: "#F1EFEC"
  on-secondary: "#201E1B"

  # Accent (v2.0) — brand punctuation: FAB, tab-active, selected chips, links,
  # focus, switch on-track. Never on amounts, never replaces primary buttons.
  # A fill that carries white TEXT (not just a glyph) uses accent-strong.
  accent: "#0E8A7B"
  accent-strong: "#0B7268"   # accent as text — 5.8:1 on surface
  accent-pressed: "#0A675C"
  accent-wash: "#EBF4F2"
  accent-edge: "#CDE4E0"
  on-accent: "#FFFFFF"       # glyphs on accent (3:1+); text needs accent-strong fill

  # Surfaces (tonal ladder, low → high)
  background: "#F6F5F3"
  surface: "#FFFFFF"
  surface-container: "#F1EFEC"
  surface-container-high: "#E8E5E0"
  surface-pressed: "#EFEDE9"
  scrim: "rgba(21,19,17,0.44)"

  # Text roles
  ink: "#201E1B"        # primary text, AA on surface & background
  dim: "#5D5952"        # secondary text, AA at all sizes
  faint: "#726C64"      # meta/labels ≥12px, AA on surface, background and wells
  disabled: "#A8A29A"   # non-text / disabled labels only
  on-inverse: "#FAF9F7" # text on primary / dark surfaces

  # Lines & low-emphasis
  outline: "#E5E2DD"
  outline-variant: "#EFEDE9"
  outline-strong: "#CFCBC4"
  chevron: "#CFCBC4"
  focus-ring: "#0E8A7B"

  # Status — semantic only, never decorative
  # base = fills and glyphs; strong = the same hue as *text on a surface*,
  # darkened so a 12–15px figure still clears AA. In dark, base and strong
  # converge — the dark hues are already tuned for text.
  success: "#16A34A"
  success-wash: "#ECFDF3"
  success-edge: "#BBF7D0"
  success-strong: "#15803D"
  on-success: "#FFFFFF"
  warning: "#D97706"
  warning-wash: "#FFFBEB"
  warning-edge: "#FDE68A"
  warning-strong: "#B45309"
  on-warning: "#FFFFFF"
  error: "#DC2626"
  error-wash: "#FEF2F2"
  error-edge: "#FECACA"
  error-strong: "#B91C1C"
  on-error: "#FFFFFF"
  info: "#2563EB"
  info-wash: "#EFF6FF"
  info-edge: "#BFDBFE"
  info-strong: "#1D4ED8"
  on-info: "#FFFFFF"

# Dark mode is defined, not deferred. Same semantic names.
# v2.0 dark: warm dark ramp; accent lightens to teal-dark and holds 6.8:1 as
# text on surface, so accent and accent-strong converge (same rule as status).
colors-dark:
  primary: "#EDEAE5"
  primary-pressed: "#CFCBC4"
  on-primary: "#151311"
  secondary: "#2C2823"
  on-secondary: "#EDEAE5"
  accent: "#3FB3A2"
  accent-strong: "#3FB3A2"
  accent-pressed: "#58C4B4"
  accent-wash: "#122622"
  accent-edge: "#1E413B"
  on-accent: "#151311"
  background: "#141210"
  surface: "#1C1917"
  surface-container: "#242019"
  surface-container-high: "#2C2823"
  surface-pressed: "#221F1B"
  scrim: "rgba(0,0,0,0.60)"
  ink: "#EDEAE5"
  dim: "#ADA79F"
  faint: "#8C867D"
  disabled: "#5D5952"
  on-inverse: "#151311"
  outline: "#322E28"
  outline-variant: "#2A2620"
  outline-strong: "#453F37"
  chevron: "#5D5952"
  focus-ring: "#3FB3A2"
  success: "#3DBB6E"
  success-wash: "#12271C"
  success-edge: "#1F4530"
  success-strong: "#3DBB6E"
  warning: "#E8A33D"
  warning-wash: "#2A1F10"
  warning-edge: "#4A3618"
  warning-strong: "#E8A33D"
  error: "#F0666B"
  error-wash: "#2A1416"
  error-edge: "#4C1F23"
  error-strong: "#F0666B"
  info: "#5B9CF8"
  info-wash: "#101E33"
  info-edge: "#1E3A5F"
  info-strong: "#5B9CF8"

typography:
  # Roles carry size + weight + line-height + tracking.
  # UI = Outfit. Every numeral = IBM Plex Mono.
  display-xl: { fontFamily: Outfit, fontSize: 40px, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em" }
  display:    { fontFamily: Outfit, fontSize: 32px, fontWeight: 700, lineHeight: 1.10, letterSpacing: "-0.02em" }
  title:      { fontFamily: Outfit, fontSize: 24px, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.01em" }
  headline:   { fontFamily: Outfit, fontSize: 20px, fontWeight: 600, lineHeight: 1.30, letterSpacing: "-0.01em" }
  body-lg:    { fontFamily: Outfit, fontSize: 17px, fontWeight: 500, lineHeight: 1.50 }
  body:       { fontFamily: Outfit, fontSize: 15px, fontWeight: 500, lineHeight: 1.50 }
  body-strong:{ fontFamily: Outfit, fontSize: 15px, fontWeight: 600, lineHeight: 1.45 }
  label:      { fontFamily: Outfit, fontSize: 13px, fontWeight: 600, lineHeight: 1.35 }
  caption:    { fontFamily: Outfit, fontSize: 12px, fontWeight: 500, lineHeight: 1.35 }
  overline:   { fontFamily: Outfit, fontSize: 11px, fontWeight: 600, lineHeight: 1.20, letterSpacing: "0.08em", textTransform: uppercase }
  amount-hero:{ fontFamily: IBMPlexMono, fontSize: 34px, fontWeight: 700, lineHeight: 1.00, letterSpacing: "-0.02em" }
  amount-lg:  { fontFamily: IBMPlexMono, fontSize: 22px, fontWeight: 700, lineHeight: 1.10, letterSpacing: "-0.01em" }
  amount:     { fontFamily: IBMPlexMono, fontSize: 15px, fontWeight: 500, lineHeight: 1.40 }
  amount-sm:  { fontFamily: IBMPlexMono, fontSize: 13px, fontWeight: 500, lineHeight: 1.40 }
  mono-meta:  { fontFamily: IBMPlexMono, fontSize: 11px, fontWeight: 400, lineHeight: 1.35 }

rounded:
  # v2.0: one step softer. Buttons/inputs xl, cards 2xl, icon tiles their own step.
  none: 0
  sm: 6px
  md: 8px
  lg: 12px
  tile: 14px
  xl: 18px
  2xl: 24px
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
  margin: 16px      # screen inset is md; the old 24 contradicted the layout prose
  card-gap: 12px    # named, so "sm (12px practice)" ambiguity is gone
  touch-min: 44px
  row-height: 56px
  row-height-fx: 72px

elevation:
  # Depth is tonal + hairline; shadows are near-invisible (warm-tinted since v2.0).
  flat: "none"
  card: "0 1px 4px rgba(32,30,27,0.06)"
  raised: "0 4px 12px rgba(32,30,27,0.08)"
  float: "0 8px 24px rgba(32,30,27,0.14)"   # FAB, bottom sheet
  inset: "inset 0 1px 2px rgba(32,30,27,0.05)"
  # Hero light (v2.0): the one sanctioned gradient. Hero cards only (Total money,
  # cash flow), one per screen, light theme only — dark uses the tonal ladder.
  hero-light: "linear-gradient(168deg, #FFFFFF 0%, #FCFDFC 55%, #F3F8F7 100%)"

motion:
  duration-instant: 90ms
  duration-fast: 160ms
  duration-base: 240ms
  duration-slow: 360ms
  ease-standard: "cubic-bezier(0.2, 0, 0, 1)"
  ease-exit: "cubic-bezier(0.4, 0, 1, 1)"
  ease-emphasized: "cubic-bezier(0.2, 0, 0, 1.2)"
  press-scale: 0.97

chart:
  # Categorical ramp, assigned by slot in fixed order; never re-assigned.
  slot-1: "#2a78d6"
  slot-2: "#eb6834"
  slot-3: "#1baf7a"
  slot-4: "#eda100"
  slot-5: "#e87ba4"
  slot-6: "#008300"
  slot-7: "#4a3aa7"
  slot-8: "#e34948"   # also the "Other" bucket
  grid: "#EFEDE9"
  axis-label: "#726C64"
  tint-alpha: 0.12    # same hue at 12% alpha = category tile / chip fill

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.xl}"
    padding: "14px {spacing.md}"
    minHeight: "{spacing.touch-min}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.outline}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.xl}"
    padding: "14px {spacing.md}"
  button-destructive:
    backgroundColor: "{colors.error-wash}"
    textColor: "{colors.error}"
    border: "1px solid {colors.error-edge}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.xl}"
    padding: "14px {spacing.md}"
  button-tertiary:
    backgroundColor: transparent
    textColor: "{colors.accent-strong}"
    typography: "{typography.label}"
    padding: "{spacing.xs} {spacing.sm}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.outline}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.md}"
    shadow: "{elevation.card}"
  list-row:
    minHeight: "{spacing.touch-min}"
    padding: "12px {spacing.md}"
    divider: "1px solid {colors.outline-variant}"
  input-field:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "12px {spacing.md}"
    minHeight: "{spacing.touch-min}"
  badge:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.dim}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  icon-box:
    size: 40px
    backgroundColor: "{colors.secondary}"
    rounded: "{rounded.tile}"
  progress-bar:
    height: 6px
    track: "{colors.surface-container-high}"
    rounded: "{rounded.full}"
  fab:
    size: 56px
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    shadow: "{elevation.float}"
---

# DESIGN.md — Financi-Ally

> Single source of truth for Financi-Ally's mobile visual identity (iOS + Android).
> Tokens above are normative — use them verbatim. Prose is rationale. When they disagree, tokens win.

## Overview

Financi-Ally is an offline-first personal expense & budget tracker built on a double-entry ledger with
multi-currency support. The UI should feel like **a well-made tool that is glad you opened it** — warm but
still calm, precise without being cold. Restraint remains the backbone: generous whitespace, monospaced
numerals that line up, color used surgically to signal meaning. Since v2.0 (sea-glass, RFC 0002) warmth is
part of the spec, not a violation of it: warm-gray neutrals, one teal accent used as punctuation, and light
on hero surfaces.

- **Personality**: warm, calm, precise (trustworthy is the product of all three)
- **Audience**: an individual managing personal finances across accounts and currencies; base currency is
  frequently IDR, with foreign-currency accounts converted to base for a unified net worth
- **Style direction**: sea-glass — editorial minimalism warmed up; tonal surfaces, hairline borders, warm
  neutrals, one accent as punctuation, semantic color untouched

## Where this lives in code

This file is canon; `mobile/` is the implementation. Two places mirror it, and both must change when a token
here changes:

| Layer | File | Holds |
|---|---|---|
| Utility tokens | `mobile/tailwind.config.js` | semantic colors, the type scale, radii, density steps — consumed as `bg-*` / `text-*` / `font-*` |
| JS tokens | `mobile/src/components/ui/tokens.ts` | values that can only be props or style objects: elevation, chart ramp + tints, category glyph mapping |

The **atomic standard** — the component library screens build from — lives in `mobile/src/components/ui/`,
one file per layer, re-exported through `index.ts`:

| Layer | Components |
|---|---|
| `core.tsx` | `Button` · `Card` · `SectionLabel` · `Amount` · `ProgressBar` · `IconBox` · `Badge` · `Chip` · `Fab` |
| `lists.tsx` | `ListRow` · `EmptyState` · `Skeleton` |
| `forms.tsx` | `Field` · `AmountField` · `Select` · `ChipGroup` · `SegmentedControl` · `SwitchRow` |
| `overlays.tsx` | `Sheet` · `Dialog` |
| `charts.tsx` | `Donut` · `TrendBars` · `ChartLegend` |

Screens import from `src/components/ui` and never from a layer file directly, so the internal split can move
without touching screens. **A screen that needs a visual it can't build from these atoms is a signal to add
an atom here first** — not to hand-roll it in the screen.

### What changed from alpha (and why)

| # | Change | Why |
|---|---|---|
| 1 | **Text roles are tokens** (`ink`/`dim`/`faint`/`disabled`/`on-inverse`) | Alpha prose referenced `ink`, `dim`, `faint` but never defined them — every implementer guessed. `faint` was also lifted to `#737C91` so it passes AA on white. |
| 2 | **Real type scale** (15 roles with size/weight/line-height/tracking) | Alpha defined seven roles all at 16px/14px — it encoded weights, not hierarchy. Screens had no sanctioned heading sizes and drifted into `text-[13px]` one-offs. |
| 3 | **Raw `palette` layer under semantic `colors`** | Semantic names could not be re-themed or extended (no wash/edge steps existed for status colors, so every red-tinted button re-invented `#FFF5F5`). |
| 4 | **Dark mode defined** (`colors-dark`) | App ships `userInterfaceStyle: automatic`; light-only tokens meant dark mode was undefined behaviour. |
| 5 | **Motion tokens** | Alpha mentioned "short transitions" with no values. |
| 6 | **Elevation tokens** (`card`/`raised`/`float`/`inset`) | Shadows were prose-only strings; the FAB shadow was undefined. |
| 7 | **Spacing fixes** — `margin: 16px`, explicit `card-gap: 12px`, `touch-min: 44px`, row heights | Alpha's `margin: 24px` token contradicted its own "content insets default to md (16px)" prose, and "sm (12px practice)" was a token that lied. |
| 8 | **Interaction states are specified** (pressed/disabled/loading per component) | Alpha covered resting appearance only. |
| 9 | **Iconography resolved: Lucide only, no emoji** | This is the one reversal from alpha: emoji category icons read playful and render differently per platform, which undercuts "precise, calm, trustworthy". Categories now use a Lucide glyph in a ramp-tinted `IconBox`. |
| 10 | **Category color mapping unified with the chart ramp** (`chart.tint-alpha`) | Categories were tinted ad-hoc, so a category's color in a list didn't match its slice in a chart. |
| 11 | **Destructive actions go through a `Dialog`** | Budgets and recurring rules deleted on a single tap of a tiny `DELETE` link. |

### What changed in v2.0 (sea-glass, and why)

Chosen from three prototyped directions in `design-explore/01-humane-visual/`; rationale in
`docs/rfc/0002-sea-glass-visual.md` and DECISION.md there.

| # | Change | Why |
|---|---|---|
| 1 | **Neutral ramp goes warm** (cool slate → warm gray; same alias names, new values) | The slate ramp read as a cold terminal. Warm grays keep the banking-statement crispness while losing the chill; every text pairing re-validated AA in both themes. |
| 2 | **Accent family added** (`accent`/`-strong`/`-pressed`/`-wash`/`-edge`, teal) | The system had zero brand hue, so nothing on screen ever felt owned. Teal enters as punctuation only — FAB, tab-active, selected chips, links, focus, switch-on — never on amounts, never replacing `primary` buttons. |
| 3 | **Info retires from chrome** | Links, focus and tertiary buttons were info-blue by default, diluting blue's meaning. They now run on accent; `info` keeps one job — transfers and neutral notices — with the same strictness as green/red/amber. |
| 4 | **Radii one step softer** (buttons/inputs 18, cards/sheets 24, icon tiles `tile` 14) | Softer shapes carry the warmth without touching layout or density. |
| 5 | **Hero light** (`elevation.hero-light`) | One sanctioned near-invisible gradient on hero cards reads as light on glass. The no-gradients rule holds everywhere else, and in dark mode entirely. |
| 6 | **`faint` darkened to `#726C64`** | The straight warm translation of the old value fell to 4.26:1 on `background`; the darker step passes 4.5 on background, surface and wells. |
| 7 | **White text needs `accent-strong` fill** | White on `accent` is 4.25:1 — enough for the FAB glyph (3:1 graphical), not for a 13px label. Any accent fill carrying text uses `accent-strong` (5.8:1). |

## Colors

The palette is quiet so the numbers do the talking, and warm so the quiet doesn't read as cold. A
near-black neutral (`primary`) still carries primary buttons and high-emphasis fills; the teal `accent`
carries the brand moments — FAB, tab-active, selected chips, links, focus, switch-on. **Green appears only
on income/gains; red only on expenses/losses; amber only on budget caution.** This strict separation is
the single most important color rule in the system, and the accent obeys it too:

- **Accent never touches money.** No amount, sign, progress-by-ratio or status meaning ever renders in
  accent. If a figure is teal, that is a bug.
- **Accent is punctuation, not paint.** One accent moment per screen region; accent fills never sit
  adjacent to success-green fills — a hairline or neutral surface always separates the two hues.
- **Accent does not replace primary.** Primary buttons stay near-black; accent takes the places gray and
  blue chrome used to sit, not the places ink sits.
- **White text sits on `accent-strong`, not `accent`.** The base fill only clears 3:1 — enough for the FAB
  glyph, not for a label.

**Structure.** `palette` holds raw ramps; `colors` holds the semantic aliases UI code consumes. Never
reference a `palette` value directly in a component — add a semantic alias instead. Each status hue has
three steps: **base** (text/marks), **wash** (fill), **edge** (border). A tinted container is always
wash + edge + base text, never base at partial opacity.

- **Primary** `#201E1B` — primary actions and high-emphasis text (`ink` is the same value).
- **Accent** `#0E8A7B` (text step `#0B7268`) — FAB, tab-active, selected chips, links, focus, switch-on.
  Tinted accent containers are `accent-wash` + `accent-edge` + `accent-strong` text, same trio rule as status.
- **Secondary** `#F1EFEC` — soft neutral fills: icon boxes, quiet chips, segmented tracks.
- **Surfaces** — `background` `#F6F5F3` → `surface` `#FFFFFF` → `surface-container` `#F1EFEC` (recessed
  wells) → `surface-container-high` `#E8E5E0` (tracks, quiet badges).
- **Text** — `ink` for primary, `dim` for secondary/supporting sentences, `faint` for meta and ALL-CAPS
  labels (≥12px only), `disabled` for disabled labels and non-text marks.
- **Lines** — `outline` for card borders and section dividers, `outline-variant` for in-card hairlines,
  `outline-strong` for a border that must read against `surface-container` (and the sheet grab handle),
  `chevron` for affordance glyphs.
- **Focus** — `focus-ring` `#0E8A7B` (accent), 2px outline + 2px offset. Always visible on
  keyboard/switch-control focus.

**Status colors carry meaning — never decorative:** `success` income, gains, synced, under budget ·
`warning` budget ≥75%, stale FX rate, offline-but-usable · `error` expenses, over budget, destructive,
validation failure · `info` transfers and neutral notices only (links moved to accent in v2.0).

**Dark mode.** `colors-dark` mirrors every semantic name. Rules that change: `primary` inverts to a light
neutral with dark `on-primary`; `accent` lightens to `#3FB3A2` and converges with `accent-strong` (6.8:1 as
text on `surface` `#1C1917`); status hues hold ≥4.5:1 on the warm dark surface; shadows and `hero-light`
are inert on dark — depth comes from the tonal ladder and `outline` only.

## Typography

**Outfit** for all UI text; **IBM Plex Mono** for every numeral. Mono numerals are non-negotiable for
money: they're tabular, so columns align and digits don't jump as values change. Outfit 400/500/600/700 and
IBM Plex Mono 400/500/700 are loaded in `app/_layout.tsx`.

IBM Plex Mono was chosen over JetBrains Mono, DM Mono, Spline Sans Mono and Recursive: its humanist skeleton
and warmer terminals read as a statement rather than a terminal, while fixed advance widths keep tabular
columns aligned. No size, weight or line-height changed with the swap. In code the family keys stay
face-agnostic (`Mono` / `Mono-Medium` / `Mono-Bold`), so a future move touches `app/_layout.tsx` only —
never a call site.

- **Hierarchy**: `display-xl`/`display` for hero screens, `title` for screen titles, `headline` for card and
  sheet titles, `body`/`body-lg` for content (Medium 500 default), `body-strong` and `label` for names and
  buttons, `caption` for helper text, `overline` for section labels.
- **Amounts**: one `amount-hero` per screen at most. `amount-lg` for card totals, `amount` inline in rows,
  `amount-sm` for the `≈ base` conversion line, `mono-meta` for rates and timestamps.
- **Never** set UI text below 12px, and never set an amount in Outfit.
- Because weight is carried by the loaded font family rather than synthesized, a type role in code is always
  a size class **plus** a family class: `text-body-strong font-sans-semibold`, `text-amount font-mono-medium`.

## Information architecture

Settled in the cross-platform wireframe round (direction 2a) and built out from the `Financi-Ally 2a - Hi-fi`
board. These are **product** decisions, not tokens. Everything below is now implemented except Spaces (see
Open gaps).

- **Buckets replace a flat accounts list.** Money lives in expandable buckets — *Cash and banks*, *Foreign*,
  *Spending*, *Owed* — each carrying one figure and its own `＋`. Hiding a bucket keeps its money in the
  total: hidden means quiet, not excluded. Budgets live inside Buckets; there is no Budget screen.
- **Spaces are the sharing boundary.** Personal / shared / freelance never mix into one total.
- **Five tab slots with the centre FAB breaking the top edge**, but the old Budget slot is now **History**:
  Home · History · **FAB** · Buckets · More. (The hi-fi board fixes this order; it supersedes the
  Buckets-then-History ordering the wireframe round sketched.) Budgets, repeating entries and reports keep
  working — they moved under **More** rather than being deleted, since direction 2a gives them no slot.
- **One "safe to spend" figure** on Home stands in for a budget screen.
- **Net-worth graph is the Home hero**, above the buckets.
- **Wording mode** — a single switch renames the whole app between plain and ledger vocabulary
  ("out of / into" vs "debit / credit"). Double-entry detail is a mode, not a default.
- **FX drift is stated on the bucket that carries it** (`converted at cached rate`, `rates 2h old`), never as
  a global banner. This refines the stale-data rule below.
- **History is one scroll** with collapsible year dividers, a running balance in the right margin, and a
  stacked bar with a labelled legend (identity-never-colour-alone still holds).
- **Destructive actions sit in a row of three**, never alone under the thumb.

## Layout & density

Mobile-first, single-column, scrollable canvases on tonal `background` with white cards floating inside.

- **Screen inset**: `spacing.margin` (16px) horizontal. Cards span the content width.
- **Rhythm**: `card-gap` (12px) between sibling cards, `lg` (24px) between titled sections,
  `sm`–`md` inside a card, `xs`–`sm` inside a row.
- **Density**: list rows are 44px minimum, 56px standard (icon box + two text lines), 72px when a row shows
  a conversion line. Never compress below 44px — even in "compact" views, drop content instead of height.
- **App shell**: top header (title + one contextual action), scrollable body, bottom tab bar. Respect
  safe-area insets on both platforms.
- Content maxes out at a single column at every width — phone-only, no two-pane layouts.

## Elevation & depth

**Tonal layers + hairline borders.** Depth comes from surface tone shifts and a 1px `outline`, not shadows.

- Cards: `surface` + 1px `outline` + `elevation.card`.
- Inputs/wells: recessed — `surface-container`, no border, optional `elevation.inset`; they read carved-in.
- Only genuinely floating affordances get `elevation.float`: the FAB and bottom sheets. Nothing else.
- Pressed states darken the surface tone (`surface-pressed`).
- **Hero light (v2.0)**: hero cards (Total money, cash flow) may carry `elevation.hero-light`, a
  near-invisible white-to-accent-tint gradient that reads as light on glass. One per screen, hero cards
  only, light theme only. Every other gradient remains banned.

## Shapes

Softly rounded — one step softer since v2.0 — one language per view. Buttons & inputs `xl` (18px) ·
cards, containers & sheets `2xl` (24px) · icon tiles `tile` (14px) · keypad keys `xl` · pills, badges,
avatars, FAB `full` · hero amounts have no container — type carries them. `lg` (12px) survives for small
interior wells. **Do not introduce sharp rectangles**, and don't mix radii on one surface.

## Motion

Short, physical, never decorative. Enter with `duration-base` + `ease-standard`; exit with `duration-fast`
+ `ease-exit`; press feedback at `duration-instant`. `ease-emphasized` only for the FAB → add-sheet
transition. Number changes cross-fade (`duration-fast`) rather than counting up. Progress bars animate width
at `duration-base`. Honour reduced-motion: keep opacity, drop transform and width animation.

React Native has no CSS easing token, so the curves are cubic béziers in code: `DURATION` and `EASING`
in `tokens.ts`, passed to `withTiming` directly.

**Press-scale is for discrete affordances only** — Button, Fab, Chip, RowAction, quick actions. Full-width
list rows stay tone-only (`surface-pressed`): a whole row shrinking reads as the card flinching, and it is
the path that costs the most on low-end Android.

The add-entry screen is a native `formSheet` presentation, so react-native-screens owns its transition —
that platform sheet *is* the FAB → add-sheet emphasized curve, and a JS animation layered over it would
only fight the OS.

Reduced-motion is handled once, inside the motion primitives (`useValueFade`, `useBarWidth`,
`usePressedScale`, and the overlay transitions), rather than left to each caller: opacity survives,
transform and width animation drop.

## Components

Every interactive component defines: **resting, pressed, disabled, loading**.

### Buttons
| Variant | Fill | Text | Border | Pressed | Disabled |
|---|---|---|---|---|---|
| Primary | `primary` | `on-primary` | — | `primary-pressed` | `secondary` fill, `disabled` text |
| Secondary | `surface` | `ink` | 1px `outline` | `surface-pressed` | `surface` fill, `disabled` text, `outline-variant` border |
| Destructive | `error-wash` | `error` | 1px `error-edge` | `error-edge` fill | `surface-container`, `disabled` text |
| Tertiary / link | none | `accent-strong` (or `ink`) | — | 60% opacity | `disabled` text |

One Primary per screen; demote everything else. **Never a green primary** — green means money-positive,
not "go" — **and never an accent primary**: accent is chrome punctuation, not an action fill. Full-width buttons in forms and sheets; inline auto-width (`fullWidth={false}`) in headers and
row actions. Loading = label swaps for a spinner at the label's color, width held constant.

### Cards
`surface`, `2xl`, 1px `outline`, `elevation.card`, padding `md` (or `padded={false}` for list cards that own
their row padding). Cards group related content; never nest a card in a card. List cards divide rows with
`outline-variant` hairlines, inset to the text column (68px) when rows have icon boxes.

### List rows
Icon box (40px, `tile`, `secondary` or category tint) · title `body-strong` in `ink` · subtitle `caption` in
`faint` · trailing amount (mono, semantic color) with optional `amount-sm` conversion line beneath ·
optional `chevron` at 16px. Whole row is the touch target; pressed = `surface-pressed`.

### Input fields
`surface-container` well, `xl`, padding 12/16, min-height 44. Label above in `label`/`ink`; helper below in
`caption`/`faint`; error state turns helper and value `error` and adds a 1px `error-edge` border. Amount
inputs use mono, right-aligned, with the currency code as a `faint` prefix.

### Selects, switches, segmented controls
Select = input well + `chevron`, opens a bottom sheet (no native dropdown). Switch track `accent` when on /
`surface-container-high` when off, knob `surface`. Segmented control = `surface-container` track, `full`
radius, active thumb `surface`, active label `ink`, inactive `faint`.

### Badges & chips
Badge: `surface-container-high` fill, `dim` text, `full`, `caption`, 3/10 padding. Status badge swaps to the
matching wash/edge/base trio **and always carries a word or glyph** — never color alone. Filter chip:
inactive = `surface` + `outline`; active = `accent-strong` fill + white label (the base `accent` fill
doesn't clear AA for 13px text).

### Progress bars
6px track (`surface-container-high`), `full`, fill semantic **by ratio**: `success` <75%, `warning` 75–99%,
`error` ≥100%. Always paired with a numeric label.

### Amounts
Every money figure is mono. In **flow** tone sign and color are automatic: `≥0` renders `success` with `+`;
`<0` renders `error` with `−` (U+2212, not a hyphen). **Neutral** tone is for figures that aren't a gain or
loss — net worth, an account balance — which render in `ink`, unsigned, going `error` only when negative.
Foreign amounts show `≈ <base>` beneath in `amount-sm`/`faint`, and a stale rate adds a `warning`
`mono-meta` line. Currency code precedes the figure (`IDR 1,250,000`). Never a bare amount.

### Section labels
`overline` (ALL-CAPS, wide tracking) in `faint`, above its card group: "Accounts", "Recent", "July budget".

### Empty, offline & error states
Empty: Lucide glyph 24px in `disabled`, one `body` line in `dim` explaining what will appear, one Tertiary
action. No illustrations. Offline / unpushed writes: `warning` badge in the header and a status strip above
the tab bar. Stale FX: `warning` `mono-meta` under the converted figure. Loading: `surface-container`
skeleton blocks at the real element's size and radius — never a full-screen spinner.

### Bottom tab bar
`surface`, 1px top `outline`, Lucide glyph + label per tab. Active = `accent-strong`, inactive = `faint`.
Labels always visible. Slots are Home · History · **FAB** · Buckets · More, with a 56px `accent` FAB (`+`)
breaking the top edge. Built as `TabBar` in `src/components/ui/nav.tsx` — a hand-laid bar rather than
expo-router's default, since the FAB is not a route.

### Bottom sheets & dialogs
Sheet: `surface`, top corners `2xl`, `elevation.float`, 4×36px `outline-strong` grab handle, `scrim` behind.
Forms and Selects open in sheets. Destructive confirms are dialogs (`2xl`, padding `lg`) with the
Destructive button trailing; the scrim does not dismiss them.

### Charts
The brand palette is deliberately neutral, so it can't encode series identity. Charts use the `chart` ramp,
assigned **by slot in fixed order** — slot 1 to the largest series — and never re-assigned when the series
count changes (a filter must not repaint the survivors). Validated on `#FFFFFF`: worst adjacent CVD ΔE 9.1,
worst adjacent normal-vision ΔE 19.6. Slots 3, 4 and 5 sit under 3:1 against the surface, so **every chart
using the ramp ships a labelled legend** with name + value — identity is never color-alone.

- Past 7 categories, fold the tail into a single "Other" slice (slot 8) rather than inventing hues.
- Series color belongs to marks only; values, labels and legends stay `ink`/`dim`/`faint`.
- A category's list tint and its chart slice should come from the same slot (`tint-alpha` 0.12) — see
  Open gaps for where the implementation currently diverges.
- Single-series charts use `accent` (or `ink`) for the emphasized period and `surface-container-high` for
  the rest — no ramp, no legend. The emphasized mark is the one chart element accent may color; it still
  never encodes gain/loss.
- Never a second y-axis; two measures of different scale get two charts. Grid and axes stay recessive.

## Do's and don'ts

- **Do** reserve green strictly for positive semantics. A green primary button conflates "money" with "go".
- **Do** use one Primary button per screen; demote everything else.
- **Do** set every money figure in IBM Plex Mono so columns line up.
- **Do** hold WCAG AA on every text-on-surface pairing, in both themes.
- **Do** add a semantic alias when you need a new color role — not a raw hex at the call site.
- **Do** add an atom to `src/components/ui/` before hand-rolling a new visual in a screen.
- **Don't** use status colors decoratively; a red badge means error/expense, full stop.
- **Do** treat accent as punctuation: one accent moment per screen region, never on an amount, never a
  button fill, never adjacent to a success-green fill.
- **Do** put white text on `accent-strong`, never on `accent` — the base fill is glyph-only contrast.
- **Don't** introduce hard drop shadows, gradients, or textures. Depth is tonal + hairline. The one
  exception is `hero-light` on hero cards, light theme only.
- **Don't** signal state with color alone — pair with sign, glyph, or text.
- **Don't** mix radii, or introduce a second typeface.
- **Don't** reach for an arbitrary size (`text-[13px]`) — if no type role fits, the scale is wrong; fix it here.
- **Do** write time and enums as words a person says — "August", "Added by a repeating entry".
- **Don't** add a color, token, or component family without updating this file first.
- **Don't** celebrate. Acknowledgment is a `dim` line, capped at one per screen (see Tone & voice).
- **Don't** put a user-facing string in a screen; it belongs in the catalog.

## Iconography

**Library**: Lucide (`lucide-react-native`), 1.75px stroke, `currentColor`. **No emoji anywhere.**

Sizes live in JS as `ICON` in `tokens.ts`, since Lucide takes `size` as a number.

| Size | Token | Value | Use |
|---|---|---|---|
| Small | `ICON.xs` / `ICON.sm` | 12 / 14px | Inline with captions, status text, badges |
| Default | `ICON.md` / `ICON.lg` / `ICON.xl` | 16 / 18 / 20px | Buttons, headers, list affordances |
| Large | `ICON.xxl` | 24px | Icon boxes, empty states, FAB |

Off-scale on purpose, literal at the call site: 22px tab glyph, 17px list callout,
13px currency chevron, 32/56px avatar marks (illustration, not iconography).

- Category and account glyphs live in a 40px `IconBox` tinted from the category's chart slot at
  `tint-alpha`, glyph in the slot's base color. The keyword → glyph table is `accountGlyph()` in `tokens.ts`;
  categories are user-named free text, so it is best-effort with a neutral fallback.
- Status glyphs inherit status color (check, triangle, x-circle).
- Low-emphasis affordances (chevron, edit, more) use `chevron` or `faint`.

## Tone & voice

The product is a competent friend who happens to be great with money. Precision and calm are the
core; being a person is allowed. Warmth rides on **copy and timing, not decoration** — no
illustrations, no mascots, no gradients. The whole warmth budget is spent on words, motion, and
moments of acknowledgment.

- **Acknowledge, never celebrate.** "You're set to finish the month under plan" is a quiet observation
  in `dim` text — not a modal, not a badge, not confetti. The app notices; it does not cheer.
  **At most one acknowledgment is visible per screen**, and it lives as a line inside a card that
  already exists, never on a surface of its own.
- **Speak to one person.** 2nd person, present tense, contractions allowed ("you're set for the
  month"). Sentence fragments are allowed where a full sentence would read like a form letter.
- **Numbers stay cold, sentences get warm.** Amounts keep mono, sign, and semantic color exactly as
  specified under Amounts. The words around them are where the human lives.
- **Time is human.** "August", "since March", "2 hours ago". A user never sees `2026-08`, an ISO
  timestamp, or a raw enum. **A machine string reaching a screen is a bug**, not a style preference.
- **Sentence case** for buttons and labels ("Save transaction", not "SAVE"). Helper text is a
  lowercase fragment with no period — "offline · using cached rates".
- **Error text is imperative and corrective, and never blames** — "That didn't save. Try again", not
  "Invalid input".
- **Banned outright:** exclamation marks, emoji, streak language, guilt language ("you overspent
  again"), celebration modals, decorative status color.

English first; amounts locale-aware (IDR base typical).

### Strings

**The string catalog is the only source of user-facing copy.** It lives in
`shared-context/domain/strings/`, one file per surface, and wording mode is a dimension of it: a leaf
is either a plain string, a function that interpolates one, or a `{ normal, finance }` pair that
resolves to the active mode. Screens read it through `useStrings()`.

A string literal in a screen is a smell. The two deliberate exceptions are accessibility labels and
component defaults inside `src/components/ui/` — the kit is a design system and stays ignorant of the
domain, so a screen overrides its defaults with a catalog string rather than the kit reaching for one.
Domain modules that already own their copy (`starter`, `recurrence`, `validate`) are catalogs in their
own right and stay where they are.

## Accessibility

AA contrast on every pairing in both themes · touch targets ≥44×44 · focus/pressed state visible on all
interactive elements · amount color always paired with an explicit `+`/`−` · status badges pair color with
glyph or word · support Dynamic Type / font scaling up to 200% (rows grow, never truncate the amount) ·
respect reduced-motion.

## Open gaps

The v1.1 information architecture landed on 2026-07-31 from the hi-fi board: buckets, History, the centre
FAB, the wording switch and the seven 2a screens are built. Dark mode was wired on 2026-08-01, closing the
eighth hi-fi screen. What remains is below.

| Gap | Canon | Current | Priority |
|---|---|---|---|
| Sea-glass tokens in code | v2.0 tokens above (warm ramp, accent, radii, hero-light) | **Closed on mobile** (RFC 0002 rollout steps 2–3: tokens, accent adoption, hero-light); the web client still carries v1.x values in `index.css` and follows in its own pass | High |
| Spaces (personal / shared / freelance) | Sharing boundary; totals never mix | No concept in the model or UI; Home and Buckets show a single inert "Personal" chip | High |
| Wording mode covers every string | One switch renames the whole app | **Closed on mobile.** Every mobile string is in the catalog and mode is a dimension of it; the web client still holds its own literals and migrates in its own pass | Med |
| Bucket reorder and hide | Press and hold to reorder; hidden means quiet, not excluded | Buckets are derived from account `type` + `currency`, so their order is fixed and none can be hidden — the hi-fi's "press and hold to reorder" hint is deliberately absent rather than inert | Med |
| Receipt photos | A receipt photo attaches to an entry | No upload path. The entry-detail placeholder was removed — it promised a feature that does not exist; this row is the record of intent | Med |
| Editing an existing entry | Entry detail offers Edit | Detail offers Duplicate + Move + Delete; Move re-files the category, but amount, date and note still cannot be changed after posting | Med |
| Foreign bucket totals | Converted at the ledger's rate | Converted client-side from `/fx/rates` for display; the row says `converted at cached rate`, and an unconvertible child collapses the whole total to `rate unavailable` | Med |
| Category slot persistence | A category's slot is assigned once and persisted, so its list tint matches its chart slice | `categorySlot()` derives the slot from the account id — stable across sessions without a migration, but it won't match the rank-ordered slice color in Reports | Med |
| Destructive actions in a row of three | Never alone under the thumb | Entry detail pairs Duplicate + Delete; `Dialog` pairs Cancel + Destructive | Low |
| Chart ramp in dark mode | Ramp re-validated against dark `surface` `#1C1917` | Validated on `#FFFFFF` only; the ramp and its 12% tints are shared across both themes unchanged | Med |
| Motion | Enter/exit/press durations and easings applied | **Closed on mobile.** `EASING` sits beside `DURATION`; sheets and dialogs animate in/out on the tokens, headline figures cross-fade, progress bars ease their width, press-scale is on every discrete affordance, and reduced-motion is honoured in the primitives. Web is unchanged | Low |
| Platform-adaptive chrome | — | Unified, iOS-flavored on both | Low |
| Brand mark | — | None exists; the wordmark is set in Outfit Bold wherever a logo would go | Low |

## Retired directions

**Numeral face** was JetBrains Mono through v1.0; replaced by IBM Plex Mono on 2026-07-31 (see Typography).

**Cool slate neutrals** (`#F2F3F7` background / `#1A1F2E` ink family) were the ramp through v1.3; replaced
by the warm-gray sea-glass ramp on 2026-08-17 (RFC 0002). Same alias names, so the swap is values-only.

**Chrome blue** — info-blue links, focus ring and tertiary buttons — retired 2026-08-17; the accent family
took those roles, and `info` narrowed to transfers and neutral notices.

**Rejected accent candidates** from the sea-glass round: warm indigo `#5B5BD6` (morning-air, drifted too
soft with its cream neutrals) and mulberry `#8E4585` (plum-hearth, accent-led, spent the color budget).
Prototypes preserved in `design-explore/01-humane-visual/variants/`.

---

**Last updated**: 2026-08-17 · **Version**: 2.0
**How AI agents should read this**: tokens above are normative — use them verbatim. Prose is rationale — it
answers "why" so judgment calls during implementation match the brand's intent. When prose and tokens
disagree, tokens win.
