# Financi-Ally mobile — design critique

**Date:** 2026-08-21 · **Scope:** 16 screens, product & interaction design (not tokens — see the separate system audit)
**Full critique:** https://claude.ai/code/artifact/5f13c170-a5cc-459e-a227-b1cf776d9886
**Companion:** [Design system audit](https://claude.ai/code/artifact/35f554e6-745a-4846-8ad6-71c25015ce3c)
**No files were modified.**

## Verdict

The design system is doing a better job than the design is. The tokens, the restraint, and the tone-of-voice work are genuinely strong. Three things undercut them: the restraint has become a hierarchy problem, the IA never settled, and there's a class of bug best called **decorative controls** — things that look pressable, aren't, and sit beside things that are.

Biggest finding is not a design finding: **the app hardcodes every transaction to the moment you type it, and offers no edit afterwards.**

## Critical

| Finding | Where |
|---|---|
| **No transaction can be dated anything but today, ever.** `e.txnDate = Date.now()`; the date chip has no `onPress` and renders `active` so it looks *more* interactive than the working Note chip beside it. DESIGN.md confirms date/amount/note can't be edited after posting either. People log in batches — this produces silently wrong data rendered in confident monospace. | entry-new.tsx:218, :387 |
| **The "Personal" space chip is `onPress={() => {}}`** — a filled active filter chip in the exact position every app puts a working filter. | buckets.tsx:132 |
| **Validation errors render as 11px `faint` hint text** — same size, weight and colour as the passive "≈ IDR 400,000" hint. `AmountWell` has no error state, against DESIGN.md:494. Worse: Save is at the bottom of the scroll, the error renders at the top, so on a small phone the user taps Save and sees nothing happen. | entry-new.tsx:335; forms.tsx:392–406 |
| **Safe-to-spend is fourth on Home at 22px**, while net worth leads at 34px — inverted against use frequency and against DESIGN.md:407 ("one safe-to-spend figure stands in for a budget screen"). Root cause: all nine Home sections are the identical card weight. | index.tsx:274–336 vs :380–400 |
| **Guests tap "Reports" and hit a signup wall with no warning.** `gated()` on More already solves this correctly (Lock glyph + rewritten subtitle); Home's QuickActions and "See all" don't use it. | index.tsx:445/450/455/410 vs more.tsx:53–60 |

## Moderate

- **Home avatar is a plain `View`** — 40px circle with initials beside a working IconButton. Not pressable. (index.tsx:256)
- **Owed bucket is inert** — no chevron, no `onPress`, while Cash/Foreign expand and Spending navigates. The one bucket with emotional charge is read-only. (buckets.tsx:228)
- **Every Home bucket row goes to the same route** — four chevrons, one destination. (index.tsx:375)
- **"Offline" renders three times**, one of them in the greeting slot as dim grey body text. (index.tsx:186–191, :272, :279; _layout.tsx:71)
- **Currency mismatch punished at submit** rather than prevented in the picker. (entry-new.tsx:195)
- **Two Save buttons with two different disabled conditions**, neither reflecting real preconditions. (entry-new.tsx:292, :406)
- **`SummaryChip` renders red before the user does anything wrong.** (entry-new.tsx:522)
- **Duplicate drops the note** — `entry-new` reads `{mode, from, to, amount}`, no `memo`. Matters because duplicate-then-delete is the only way to correct an entry. (entry/[id].tsx:247)
- **Sign out**: full-width destructive, alone at the bottom, no Dialog, directly under a "pending" badge. Violates DESIGN.md:415 and :338.

## Consistency

- `setup-checklist.tsx:53` hand-rolls a progress bar (`bg-ink`, unanimated) instead of `<ProgressBar>`.
- `setup-checklist.tsx:69` uses `bg-success` for a ticked step — green is reserved for income/gains, DESIGN.md's "single most important color rule".
- Same line passes `color={C.onPrimary}` on green: white in light, near-black in dark. The right token (`on-success`) is in DESIGN.md but was never added to the JS palette — the palette gap caused the bug.
- `ChartLegend` uses a round swatch, `LegendDot` a square one. Same job.
- More is seven rows in one card mixing destinations, settings and actions; "Add pocket" duplicates the Buckets header button.
- Setup wizard's Continue button jumps ~52px when Back appears on step 2 — double-tap goes forward then backward. (setup.tsx:114)
- Setup "Skip" is a bare `<Text onPress>` — no Pressable, no touch minimum, no pressed state.

## What works

- **The voice.** `moments.ts` — four strings, all four right. Acknowledges without congratulating.
- **6 taps to log an expense** (FAB → category → 2/5/000 → Save). Remembered pocket + `000` key + category rail compounding.
- **Progressive disclosure in the add sheet** — `SummaryChip` folds pocket/date/note for the common case, expands only for transfers.
- **Chevron direction carries meaning** — up/down for expand-in-place, right for navigate. Subtle and usually got wrong.
- **Wording mode** — one switch renaming the whole app, `Dr`/`Cr` only in finance mode.
- **`gated()` on More** — the correct locked-state pattern, just under-used.

## Priority

1. **Date picker, then Edit.** Everything else is polish next to a ledger that can only be written in the present tense.
2. **Fix the add-sheet error state** — `error` prop on `AmountWell`, scroll into view on rejection.
3. **Delete or wire the four decorative controls** — space chip, avatar, Owed row, date chip.
4. **Invert Home's hierarchy** and add one secondary card weight.
5. **Extend `gated()`** to Home's quick actions and "See all".