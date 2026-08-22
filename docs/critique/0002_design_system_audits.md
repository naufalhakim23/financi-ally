# Financi-Ally mobile — design system audit

**Date:** 2026-08-21 · **Scope:** `mobile/` (24 screens, 7 kit files) vs `DESIGN.md` v1.3
**Score:** 74/100 · 2 critical, 5 high, 7 medium · **zero token drift**
**Full report:** https://claude.ai/code/artifact/35f554e6-745a-4846-8ad6-71c25015ce3c
**No files were modified.**

## Verdict

Better-governed than most production design systems. `check-tokens.mjs` passes clean (19 light / 19 dark in sync across `global.css` and `tokens.ts`), only three arbitrary Tailwind values exist in the whole app, and zero raw hex outside `tokens.ts`. The findings are gaps in the guard rails, not mess.

Three themes account for nearly everything:

1. The ESLint token guard only inspects `className` strings, so RN's `style={{…}}` spacing vocabulary is unpoliced.
2. Accessibility is asserted in DESIGN.md but never verified — one core text color fails the standard the doc claims for it.
3. The tab bar, segmented control and FAB have moved on from canon without canon being updated.

## Findings

| # | Sev | Finding | Where |
|---|---|---|---|
| 01 | Critical | `faint` (#737C91) fails WCAG AA on all four light surfaces — 4.18 on white, needs 4.50. DESIGN.md claims twice that it passes. 56 uses / 21 files. Fix: `#62697B` (5.49 / 4.95 / 4.87 / 4.57). | DESIGN.md:63, :328 |
| 02 | Critical | `Sheet` has no `KeyboardAvoidingView`; two `autoFocus` inputs in the add-entry flow are covered by the keyboard. Both are also hand-rolled `TextInput`s duplicating the `Field` recipe. | overlays.tsx:48–102; entry-new.tsx:441, 479 |
| 03 | High | 72 inline `gap` values; 24 are off the spacing scale (3, 5, 6×11, 10×8, 14). Three are inside the kit itself. Guard can't see ObjectExpressions. | eslint.config.mjs:8–9 |
| 04 | High | Sub-44px touch targets with no hitSlop: `RowAction` 36px, `IconButton` 40px, `ScreenHeader` back control collapses to 18px without a label. | lists.tsx:224; nav.tsx:201, :135 |
| 05 | High | No `FlatList`/`SectionList` anywhere — History renders the unbounded ledger into a plain ScrollView. | history.tsx:241–316; entry-row.tsx:73 |
| 06 | High | Tab bar is a floating island with `ELEVATION.float`; canon describes an edge-anchored bar and says float is for "the FAB and bottom sheets. Nothing else." Code is right, doc is stale. | nav.tsx:39–43 vs DESIGN.md:436, 528 |
| 07 | High | Chart slot 7 (#4a3aa7) measures 2.02:1 on dark surface. Closes the "chart ramp in dark mode" open gap. Fix: `#7A6BD0` (4.34 light / 3.98 dark). | tokens.ts CHART_SLOTS |
| 08 | Med | Two `Fab` components; the exported one (core.tsx:210) is dead and shadowed by nav.tsx:86. | core.tsx:210, nav.tsx:86 |
| 09 | Med | No chart sets `accessibilityRole`/`Label`. Home's sparkline has no legend either, so it's fully silent. Same for `ProgressBar` and `Amount`. | charts.tsx; core.tsx:307, :260 |
| 10 | Med | Segmented control uses `rounded-lg` + literal `borderRadius: 10`; canon says `full` radius. | forms.tsx:340, :356 vs DESIGN.md:501 |
| 11 | Med | `overline` and `mono-meta` are 11px; DESIGN.md:389 says "never below 12px". Both normally render in `faint` — smallest and lowest-contrast at once. | DESIGN.md:151, :156 |
| 12 | Med | Sync strip pinned at `bottom-[92px]`; the tab island measures ~97px with a home indicator, ~75px without. | _layout.tsx:81 |
| 13 | Med | Eight kit components undocumented (`ErrorNotice`, `RowAction`, `BucketChildRow`, `DayHeader`, `AmountWell`, `Keypad`, `StackedBar`, `GroupedBars`, `LegendDot`); the whole `nav.tsx` layer is missing from the table. | DESIGN.md:311–318 |
| 14 | Med | Dynamic Type to 200% claimed but blocked: `numberOfLines={1}` title, fixed `min-h-row`, unbounded `Amount`. No evidence of testing. | lists.tsx:90–123 |

## Measured contrast (light palette)

| Pairing | Ratio | Result |
|---|---|---|
| faint on surface #FFFFFF | 4.18 | **Fails** |
| faint on background #F2F3F7 | 3.77 | **Fails** |
| faint on surface-container #F0F1F6 | 3.71 | **Fails** |
| faint on surface-container-high #E8EAF2 | 3.48 | **Fails** |
| dim on surface | 6.01 | Passes |
| success-strong / warning-strong on surface | 5.02 | Passes |
| success-strong / warning-strong on container-high | 4.18 | **Fails** |

Dark palette: every text-on-surface pairing clears AA.

## Suggested order

**01, 02, 03** first — every screen, the primary flow, and the leak that produces the next hundred off-scale values.
Then **06 + 10 + 13** as one session: all three are "canon has fallen behind the code", and DESIGN.md is what everything else derives from.

## Smaller notes

- `Sheet` missing `accessibilityViewIsModal` (Dialog has it).
- `Skeleton` hardcodes 700ms / `Easing.quad` — only motion in the kit off the tokens.
- `Field` `editable={false}` is visually identical to editable; error text not associated with the input.
- `Chip`, `RowAction`, `IconButton` have no disabled state (DESIGN.md:469 requires four states).
- `Button` glyph passes `color={undefined}` — Lucide defaults to `currentColor`, which react-native-svg can't inherit here. Verify a glyph on a primary button isn't black-on-near-black.
- `Badge` neutral tone lacks the border every status tone has → 2px size shift between tones.
- `Button` loading doesn't hold width for `fullWidth={false}`, against DESIGN.md:481.