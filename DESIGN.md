---
version: 1.1
name: Financi-Ally
description: Offline-first personal expense & budget tracker — double-entry ledger, multi-currency, mobile (iOS + Android).
supersedes: DESIGN.md alpha, and v1.0 (JetBrains Mono numerals — see Retired directions)

# ─────────────────────────────────────────────────────────────
# TOKENS — normative. Two layers: raw scales, then semantic
# aliases. UI code references SEMANTIC names only.
# ─────────────────────────────────────────────────────────────

palette:
  # Neutral ramp (single family — cool-tinted slate; the whole UI is built from it)
  neutral-0: "#FFFFFF"
  neutral-50: "#F7F8FB"
  neutral-100: "#F2F3F7"
  neutral-150: "#EEF0F6"
  neutral-200: "#E2E6F0"
  neutral-300: "#C0C7DA"
  neutral-400: "#98A1B5"
  neutral-500: "#737C91"
  neutral-600: "#5A6379"
  neutral-800: "#2A3140"
  neutral-900: "#1A1F2E"
  neutral-950: "#0F1218"
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
  primary: "#1A1F2E"
  primary-pressed: "#2A3140"
  on-primary: "#FFFFFF"
  secondary: "#EEF0F6"
  on-secondary: "#1A1F2E"

  # Surfaces (tonal ladder, low → high)
  background: "#F2F3F7"
  surface: "#FFFFFF"
  surface-container: "#F0F1F6"
  surface-container-high: "#E8EAF2"
  surface-pressed: "#EEF0F6"
  scrim: "rgba(15,18,24,0.44)"

  # Text roles
  ink: "#1A1F2E"        # primary text, AA on surface & background
  dim: "#5A6379"        # secondary text, AA at all sizes
  faint: "#737C91"      # meta/labels ≥12px, AA on surface
  disabled: "#98A1B5"   # non-text / disabled labels only
  on-inverse: "#F7F8FB" # text on primary / dark surfaces

  # Lines & low-emphasis
  outline: "#E2E6F0"
  outline-variant: "#F0F1F6"
  outline-strong: "#C0C7DA"
  chevron: "#C0C7DA"
  focus-ring: "#2563EB"

  # Status — semantic only, never decorative
  success: "#16A34A"
  success-wash: "#ECFDF3"
  success-edge: "#BBF7D0"
  on-success: "#FFFFFF"
  warning: "#D97706"
  warning-wash: "#FFFBEB"
  warning-edge: "#FDE68A"
  on-warning: "#FFFFFF"
  error: "#DC2626"
  error-wash: "#FEF2F2"
  error-edge: "#FECACA"
  on-error: "#FFFFFF"
  info: "#2563EB"
  info-wash: "#EFF6FF"
  info-edge: "#BFDBFE"
  on-info: "#FFFFFF"

# Dark mode is defined, not deferred. Same semantic names.
colors-dark:
  primary: "#EEF0F6"
  primary-pressed: "#C0C7DA"
  on-primary: "#131722"
  secondary: "#262C38"
  on-secondary: "#EDEFF4"
  background: "#0F1218"
  surface: "#171B23"
  surface-container: "#1E232D"
  surface-container-high: "#262C38"
  surface-pressed: "#20252F"
  scrim: "rgba(0,0,0,0.60)"
  ink: "#EDEFF4"
  dim: "#A7AFC0"
  faint: "#8A93A8"
  disabled: "#5A6379"
  on-inverse: "#131722"
  outline: "#2C3340"
  outline-variant: "#232935"
  outline-strong: "#3B4453"
  chevron: "#5A6379"
  focus-ring: "#5B9CF8"
  success: "#3DBB6E"
  success-wash: "#12271C"
  success-edge: "#1F4530"
  warning: "#E8A33D"
  warning-wash: "#2A1F10"
  warning-edge: "#4A3618"
  error: "#F0666B"
  error-wash: "#2A1416"
  error-edge: "#4C1F23"
  info: "#5B9CF8"
  info-wash: "#101E33"
  info-edge: "#1E3A5F"

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
  margin: 16px      # screen inset is md; the old 24 contradicted the layout prose
  card-gap: 12px    # named, so "sm (12px practice)" ambiguity is gone
  touch-min: 44px
  row-height: 56px
  row-height-fx: 72px

elevation:
  # Depth is tonal + hairline; shadows are near-invisible.
  flat: "none"
  card: "0 1px 4px rgba(26,31,46,0.06)"
  raised: "0 4px 12px rgba(26,31,46,0.08)"
  float: "0 8px 24px rgba(26,31,46,0.14)"   # FAB, bottom sheet
  inset: "inset 0 1px 2px rgba(26,31,46,0.05)"

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
  grid: "#EEF0F6"
  axis-label: "#737C91"
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
    textColor: "{colors.info}"
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
    rounded: "{rounded.lg}"
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
    rounded: "{rounded.xl}"
  progress-bar:
    height: 6px
    track: "{colors.surface-container-high}"
    rounded: "{rounded.full}"
  fab:
    size: 56px
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    shadow: "{elevation.float}"
---

# DESIGN.md — Financi-Ally

> Single source of truth for Financi-Ally's mobile visual identity (iOS + Android).
> Tokens above are normative — use them verbatim. Prose is rationale. When they disagree, tokens win.

## Overview

Financi-Ally is an offline-first personal expense & budget tracker built on a double-entry ledger with
multi-currency support. The UI should feel like a calm, trustworthy financial tool — closer to a private
banking statement than a gamified spending app. **Restraint is the aesthetic**: generous whitespace,
monospaced numerals that line up, color used surgically to signal meaning rather than to decorate.

- **Personality**: precise, calm, trustworthy
- **Audience**: an individual managing personal finances across accounts and currencies; base currency is
  frequently IDR, with foreign-currency accounts converted to base for a unified net worth
- **Style direction**: editorial minimalism with financial-services calm — tonal surfaces, hairline borders,
  one neutral primary, semantic color only

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

## Colors

The palette is intentionally quiet so the numbers do the talking. A near-black neutral (`primary`) carries
every structural action — primary buttons, tab-active, FAB — so the eye never mistakes a brand flourish for
a semantic signal. **Green appears only on income/gains; red only on expenses/losses; amber only on budget
caution.** This strict separation is the single most important color rule in the system.

**Structure.** `palette` holds raw ramps; `colors` holds the semantic aliases UI code consumes. Never
reference a `palette` value directly in a component — add a semantic alias instead. Each status hue has
three steps: **base** (text/marks), **wash** (fill), **edge** (border). A tinted container is always
wash + edge + base text, never base at partial opacity.

- **Primary** `#1A1F2E` — primary actions, tab-active, FAB, high-emphasis text (`ink` is the same value).
- **Secondary** `#EEF0F6` — soft neutral fills: icon boxes, quiet chips, segmented tracks.
- **Surfaces** — `background` `#F2F3F7` → `surface` `#FFFFFF` → `surface-container` `#F0F1F6` (recessed
  wells) → `surface-container-high` `#E8EAF2` (tracks, quiet badges).
- **Text** — `ink` for primary, `dim` for secondary/supporting sentences, `faint` for meta and ALL-CAPS
  labels (≥12px only), `disabled` for disabled labels and non-text marks.
- **Lines** — `outline` for card borders and section dividers, `outline-variant` for in-card hairlines,
  `outline-strong` for a border that must read against `surface-container` (and the sheet grab handle),
  `chevron` for affordance glyphs.
- **Focus** — `focus-ring` `#2563EB`, 2px outline + 2px offset. Always visible on keyboard/switch-control focus.

**Status colors carry meaning — never decorative:** `success` income, gains, synced, under budget ·
`warning` budget ≥75%, stale FX rate, offline-but-usable · `error` expenses, over budget, destructive,
validation failure · `info` transfers, inline links, neutral notices.

**Dark mode.** `colors-dark` mirrors every semantic name. Rules that change: `primary` inverts to a light
neutral with dark `on-primary`; status hues lighten to hold ≥4.5:1 on `surface` `#171B23`; shadows are
inert on dark — depth comes from the tonal ladder and `outline` only. **Defined but not yet wired** — see
Open gaps.

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

Settled in the cross-platform wireframe round (direction 2a). These are **product** decisions, not tokens —
and none of them are built yet (see Open gaps). The shipped app is still the pre-2a shape: a flat pockets
list, a Budgets tab, and no Spaces.

- **Buckets replace a flat accounts list.** Money lives in expandable buckets — *Cash and banks*, *Foreign*,
  *Spending*, *Owed* — each carrying one figure and its own `＋`. Hiding a bucket keeps its money in the
  total: hidden means quiet, not excluded. Budgets live inside Buckets; there is no Budget screen.
- **Spaces are the sharing boundary.** Personal / shared / freelance never mix into one total.
- **Five tab slots with the centre FAB breaking the top edge**, but the old Budget slot is now **History**:
  Home · Buckets · **FAB** · History · Settings.
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

## Shapes

Softly rounded, one language per view. Buttons `xl` (16px) · cards & containers `2xl` (20px) ·
inputs & wells `lg` (12px) · icon tiles `xl` · pills, badges, avatars, FAB `full` · hero amounts have no
container — type carries them. **Do not introduce sharp rectangles**, and don't mix radii on one surface.

## Motion

Short, physical, never decorative. Enter with `duration-base` + `ease-standard`; exit with `duration-fast`
+ `ease-exit`; press feedback at `duration-instant`. `ease-emphasized` only for the FAB → add-sheet
transition. Number changes cross-fade (`duration-fast`) rather than counting up. Progress bars animate width
at `duration-base`. Honour reduced-motion: keep opacity, drop transform and width animation.

React Native has no CSS easing token, so in code only the durations travel (`DURATION` in `tokens.ts`);
press feedback is expressed as a tone change rather than a timing curve.

## Components

Every interactive component defines: **resting, pressed, disabled, loading**.

### Buttons
| Variant | Fill | Text | Border | Pressed | Disabled |
|---|---|---|---|---|---|
| Primary | `primary` | `on-primary` | — | `primary-pressed` | `secondary` fill, `disabled` text |
| Secondary | `surface` | `ink` | 1px `outline` | `surface-pressed` | `surface` fill, `disabled` text, `outline-variant` border |
| Destructive | `error-wash` | `error` | 1px `error-edge` | `error-edge` fill | `surface-container`, `disabled` text |
| Tertiary / link | none | `info` (or `ink`) | — | 60% opacity | `disabled` text |

One Primary per screen; demote everything else. **Never a green primary** — green means money-positive,
not "go". Full-width buttons in forms and sheets; inline auto-width (`fullWidth={false}`) in headers and
row actions. Loading = label swaps for a spinner at the label's color, width held constant.

### Cards
`surface`, `2xl`, 1px `outline`, `elevation.card`, padding `md` (or `padded={false}` for list cards that own
their row padding). Cards group related content; never nest a card in a card. List cards divide rows with
`outline-variant` hairlines, inset to the text column (68px) when rows have icon boxes.

### List rows
Icon box (40px, `xl`, `secondary` or category tint) · title `body-strong` in `ink` · subtitle `caption` in
`faint` · trailing amount (mono, semantic color) with optional `amount-sm` conversion line beneath ·
optional `chevron` at 16px. Whole row is the touch target; pressed = `surface-pressed`.

### Input fields
`surface-container` well, `lg`, padding 12/16, min-height 44. Label above in `label`/`ink`; helper below in
`caption`/`faint`; error state turns helper and value `error` and adds a 1px `error-edge` border. Amount
inputs use mono, right-aligned, with the currency code as a `faint` prefix.

### Selects, switches, segmented controls
Select = input well + `chevron`, opens a bottom sheet (no native dropdown). Switch track `primary` when on /
`surface-container-high` when off, knob `surface`. Segmented control = `surface-container` track, `full`
radius, active thumb `surface`, active label `ink`, inactive `faint`.

### Badges & chips
Badge: `surface-container-high` fill, `dim` text, `full`, `caption`, 3/10 padding. Status badge swaps to the
matching wash/edge/base trio **and always carries a word or glyph** — never color alone. Filter chip:
inactive = `surface` + `outline`; active = `primary` fill + `on-primary`.

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
`surface`, 1px top `outline`, Lucide glyph + label per tab. Active = `primary`, inactive = `faint`. Labels
always visible. Canonical slots are Home · Buckets · **FAB** · History · Settings, with a 56px `primary` FAB
(`+`) breaking the top edge. The shipped bar is still Home · Pockets · Budgets · Recurring · Reports with no
FAB — see Open gaps.

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
- Single-series charts use `primary` for the current period and `surface-container-high` for the rest — no
  ramp, no legend.
- Never a second y-axis; two measures of different scale get two charts. Grid and axes stay recessive.

## Do's and don'ts

- **Do** reserve green strictly for positive semantics. A green primary button conflates "money" with "go".
- **Do** use one Primary button per screen; demote everything else.
- **Do** set every money figure in IBM Plex Mono so columns line up.
- **Do** hold WCAG AA on every text-on-surface pairing, in both themes.
- **Do** add a semantic alias when you need a new color role — not a raw hex at the call site.
- **Do** add an atom to `src/components/ui/` before hand-rolling a new visual in a screen.
- **Don't** use status colors decoratively; a red badge means error/expense, full stop.
- **Don't** introduce hard drop shadows, gradients, or textures. Depth is tonal + hairline.
- **Don't** signal state with color alone — pair with sign, glyph, or text.
- **Don't** mix radii, or introduce a second typeface.
- **Don't** reach for an arbitrary size (`text-[13px]`) — if no type role fits, the scale is wrong; fix it here.
- **Don't** add a color, token, or component family without updating this file first.

## Iconography

**Library**: Lucide (`lucide-react-native`), 1.75px stroke, `currentColor`. **No emoji anywhere.**

| Size | Value | Use |
|---|---|---|
| Small | 12–14px | Inline with captions, status text, badges |
| Default | 16–20px | Buttons, headers, list affordances, tab bar |
| Large | 24px | Icon boxes, empty states, FAB |

- Category and account glyphs live in a 40px `IconBox` tinted from the category's chart slot at
  `tint-alpha`, glyph in the slot's base color. The keyword → glyph table is `accountGlyph()` in `tokens.ts`;
  categories are user-named free text, so it is best-effort with a neutral fallback.
- Status glyphs inherit status color (check, triangle, x-circle).
- Low-emphasis affordances (chevron, edit, more) use `chevron` or `faint`.

## Tone & voice

Precise, calm, encouraging but not cheerful. 2nd person for guidance, neutral for labels.
**Sentence case** for buttons and labels ("Save transaction", not "SAVE"). Helper text is a lowercase
fragment with no period — "offline · using cached rates". Error text is imperative and corrective —
"Enter a valid amount". Amounts are always signed and colored, never bare. No exclamation marks, no
congratulation, no gamified streak language. English first; amounts locale-aware (IDR base typical).

## Accessibility

AA contrast on every pairing in both themes · touch targets ≥44×44 · focus/pressed state visible on all
interactive elements · amount color always paired with an explicit `+`/`−` · status badges pair color with
glyph or word · support Dynamic Type / font scaling up to 200% (rows grow, never truncate the amount) ·
respect reduced-motion.

## Open gaps

The v1.1 information architecture (buckets, Spaces, History, wording mode) is designed but **not built** —
the shipped app is still the pre-2a shape. Those rows are product work, not drift.

| Gap | Canon | Current | Priority |
|---|---|---|---|
| Buckets replace the flat pockets list | Expandable buckets, each with one figure and its own `＋`; budgets live inside | `pockets.tsx` is a flat asset/liability list; `budgets.tsx` is its own tab | High |
| History replaces the Budgets tab slot | Home · Buckets · FAB · History · Settings | Home · Pockets · Budgets · Recurring · Reports, no Settings | High |
| Spaces (personal / shared / freelance) | Sharing boundary; totals never mix | No concept in the model or UI | High |
| "Safe to spend" on Home; net-worth graph as the hero | One figure + graph above the buckets | Net-worth figure only, no graph | High |
| `BucketRow`, `RunningBalance`, net-worth sparkline, collapsible year divider | Primitives in the atomic standard | Not built — no atom exists for any of them | High |
| Wording mode (plain ↔ ledger vocabulary) | One switch renames the whole app | Ledger vocabulary is hardcoded ("credit"/"debit" in entry-new) | Med |
| Center FAB in the tab bar | 5-slot bar with a 56px `primary` FAB breaking the top edge | `Fab` atom exists and is unused; Add is the Dashboard's Primary button. Needs a custom `tabBar` to replace expo-router's default | Med |
| Dark mode wiring | `colors-dark` applied at runtime | Tokens defined here; `tailwind.config.js` carries the light values only, so the app is light-only | Med |
| Category slot persistence | A category's slot is assigned once and persisted, so its list tint matches its chart slice | `categorySlot()` derives the slot from the account id — stable across sessions without a migration, but it won't match the rank-ordered slice color in Reports | Med |
| FX drift stated per bucket | `converted at cached rate` on the bucket that carries it | Global sync strip above the tab bar | Med |
| Destructive actions in a row of three | Never alone under the thumb | `Dialog` puts Cancel + Destructive in a row of two | Low |
| Chart ramp in dark mode | Ramp re-validated against dark `surface` `#171B23` | Validated on `#FFFFFF` only | Low |
| Motion | Enter/exit/press durations and easings applied | Only `Modal` defaults animate; press feedback is a tone change | Low |
| Platform-adaptive chrome | — | Unified, iOS-flavored on both | Low |
| Brand mark | — | None exists; the wordmark is set in Outfit Bold wherever a logo would go | Low |

## Retired directions

**Numeral face** was JetBrains Mono through v1.0; replaced by IBM Plex Mono on 2026-07-31 (see Typography).

---

**Last updated**: 2026-07-31 · **Version**: 1.1
**How AI agents should read this**: tokens above are normative — use them verbatim. Prose is rationale — it
answers "why" so judgment calls during implementation match the brand's intent. When prose and tokens
disagree, tokens win.
