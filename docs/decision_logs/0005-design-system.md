# 0005 — Mobile Design System

**Date**: 2026-07-28
**Status**: Decided
**Context**: M7 design-system work pulled forward. `shared-context/design/prototype1` is a Figma-export wireframe (HTML/React) for the expense tracker. Mobile UI was token-less (`tailwind.config extend: {}`), black/gray/blue primitives. Boss asked to build a design system from the prototype, iOS + Android, "from color to everything."

## Decisions

### 1. Neutral primary, green = positive semantics only
**Chose**: `primary #1A1F2E` (near-black neutral) for all structural actions (primary button, tab-active, FAB). Green `#16A34A` reserved strictly for income/gains/under-budget.

**Rejected**: adopt prototype's brand green `#1D6F42` as primary. The prototype uses green for the FAB and primary buttons, but that conflates "go" with "money." In a finance app where green already means income and red means expense, a green primary button erodes the semantic signal. Neutral primary keeps status colors unambiguous.

**Cost**: diverges from the prototype's visual identity (which is green-forward). Accepted — correctness of semantic color > pixel-faithfulness to a wireframe.

### 2. Typography: bundle Outfit + JetBrains Mono
**Chose**: `@expo-google-fonts/outfit` + `@expo-google-fonts/jetbrains-mono` + `expo-font`, loaded in root `_layout.tsx` behind a gate. Outfit for UI, JetBrains Mono for every numeral.

**Rejected**: native system fonts (SF/Roboto). Bundling costs ~font assets + a font gate, but Outfit is the prototype's identity and JetBrains Mono gives tabular figures — non-negotiable for money columns that must align. Named weight families (`Outfit-Bold`, `Mono-Bold`) are referenced explicitly instead of `fontWeight` utilities, because RN won't auto-resolve a separate registered family from `fontWeight`.

### 3. Unified look on iOS + Android
**Chose**: one visual language on both (iOS-flavored, applied consistently).

**Rejected**: platform-adaptive chrome (iOS Dynamic-Island-ish status / Material nav). More native per platform, but doubles conditional code. Deferred until the unified base ships and Boss wants platform distinction.

### 4. Scope: tokens + atomic components + reskin 4 existing screens
**Chose**: DESIGN.md canon + tailwind tokens + `src/components/ui.tsx` atoms + restyle Home/Pockets/Budgets/entry-new + tab bar. Auth screens reskinned free via `forms.tsx`.

**Rejected**: also build the prototype's missing screens (Accounts grouped, Ledger detail, Currencies/rates). Largest scope; deferred to a follow-up. The design system is proven on real screens without expanding data-layer wiring.

## Consequential calls

- **Center FAB deferred**: prototype's bottom-nav center `+` is a nav restructure (not a restyle). Kept the dashboard "New entry" primary button as the Add affordance. Gap logged in DESIGN.md.
- **Amount display**: ISO-code suffix + thousand grouping (`50,000 IDR`), no currency symbol. The shared `money.format()` stays wire-pure (no grouping, no symbol) so wire amounts are untouched; grouping is display-only inside the `Amount` atom. Locale-safe across 150+ currencies where symbols get ambiguous.
- **No emoji/category-icon mapping**: data layer has no category metadata, so list rows use a generic 💸 glyph. Real per-category icons are a follow-up once categories carry metadata.

## Files
- `DESIGN.md` (project root) — canon, Stitch format
- `mobile/tailwind.config.js` — token mirror
- `mobile/app/_layout.tsx` — font gate
- `mobile/src/components/ui.tsx` — Card, SectionLabel, Amount, ProgressBar, IconBox, Badge, SegmentedControl
- `mobile/src/components/forms.tsx` — restyled Field/AmountField/Picker/Primary/Secondary + DestructiveButton
- `mobile/app/(app)/{index,pockets,budgets,entry-new,_layout}.tsx` — reskinned
