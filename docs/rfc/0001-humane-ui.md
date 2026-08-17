# RFC 0001: Humane UI

- Status: Draft (awaiting Boss approval)
- Date: 2026-08-17
- Scope: mobile first; DESIGN.md canon changes apply to both clients, web implementation follows in a later pass
- Related: DESIGN.md v1.3, decision logs 0005 (design system), 0013 (web W4-W6), 0014 (first-run onboarding)

## Problem

The app is disciplined but sterile. Boss's read: "it still felt like not for humans." Two distinct causes, confirmed by a full trace of both clients:

**Class A: mechanical leaks.** Places where the ledger/API model shows through the skin. These are bugs against the existing canon, not taste questions.

| Leak | Where |
|---|---|
| Reports and Budgets bypass the wording layer: hardcoded "Net worth", "Assets", "Liabilities", "Cash flow" | `mobile/app/(app)/reports.tsx`, `budgets.tsx` |
| Ungrouped amounts, `IDR 1500000`, raw `format()` where `formatGrouped()` exists | same two screens |
| Raw `2026-08` period string as a visible card title, while `monthLabel()` exists and is used elsewhere | mobile and web budgets |
| Backend enum printed verbatim: `entry.source` renders `manual` / `recurring` | `web/src/routes/entry-detail.tsx` |
| Wording dictionary covers only 7 terms; body copy on less-visited screens is not mode-aware | `shared-context/domain/wording.ts` |
| Receipt-photo placeholder promises a feature that does not exist | mobile entry detail |
| "Other (8)" chart bucket label; CSV export with no explanation of what it is | reports, web history |

**Class B: sterility by design.** DESIGN.md's "restraint is the aesthetic" bans warmth outright: no congratulation, no illustration, low-affect everywhere. The result, in the explorer's words: the app "optimizes entirely for not lying to you about money, never for glad to see you." Onboarding, empty states, and the landing page all share one flat register. Motion tokens are defined but unapplied, so the app is also physically static. Add-entry stacks six interactive zones before the keypad.

## Decision summary (settled with Boss, 2026-08-17)

1. Direction: all four axes. Warmth and personality, kill remaining jargon, lighter flows, motion and feel.
2. Scope: mobile first. Canon changes land in DESIGN.md and bind both clients; web implementation is a follow-up RFC or milestone.
3. Tone ceiling: **warm but still calm.** The private-banking-statement core stays. Human voice, greetings, moments of acknowledgment are in. Confetti, streaks, emoji, exclamation marks stay banned.
4. Strings: **full string catalog.** Every user-facing string moves to a central catalog; wording mode (plain vs finance) becomes a dimension of the catalog rather than a 7-term patch. English only for now; the catalog makes locales possible later but i18n is explicitly not this RFC.
5. Add-entry: **progressive disclosure in the single existing flow.** No second quick-add surface.

## Design principles (the DESIGN.md amendment, in prose)

The identity moves from "private banking statement" to "a competent friend who happens to be great with money." Precision and calm survive; the ban on being a person does not.

- **Warmth rides on copy and timing, not decoration.** No illustrations, no mascots, no gradients. The warmth budget is spent on words, motion, and acknowledgment moments.
- **Acknowledge, never celebrate.** "Third week in a row under budget" is a quiet observation in `dim` text, not a modal, not a badge, not confetti. The app notices; it does not cheer.
- **Speak to one person.** Second person, present tense, contractions allowed ("you're set for the month"). Sentence fragments allowed where a full sentence would sound like a form letter.
- **Numbers stay cold, sentences get warm.** Amounts keep mono, sign, and semantic color exactly as today. The words around them are where the human lives.
- **Time is human.** "August", "since March", "2 hours ago". A user never sees `2026-08`, an ISO timestamp, or a raw enum. Machine strings appearing in UI are always a bug.
- **Still banned:** exclamation marks, emoji, streak language, guilt language ("you overspent again"), celebration modals, decorative status color.

## Workstreams

Ordered so each lands independently. H1 is foundation for H2.

### H1: String catalog and jargon kill

Move every user-facing string in the mobile app into a catalog in `shared-context/domain/strings/` (shared home, mobile consumes first; web migrates when its pass comes). Shape:

```ts
// strings are functions when they interpolate; wording mode is a dimension
catalog.reports.netWorth        // { normal: "Total money", finance: "Net worth" }
catalog.entry.source.recurring  // "Added by a repeating entry"
catalog.budgets.periodTitle(d)  // "August" via monthLabel
```

- `useWording()` becomes `useStrings()`: returns the catalog resolved for the active mode. The existing 7-term `TERMS` map folds into it; `term()` stays as a shim until all call sites move.
- Reports and Budgets route through the catalog (closes the wording-layer bypass).
- All amounts on Reports/Budgets switch to `formatGrouped`. Grouped formatting becomes the rule: raw `format()` is for inputs and exports only.
- `monthLabel()` everywhere a period is shown. Kill both `period.slice(0, 7)` sites.
- Human labels for `entry.source` and any other enum that reaches a screen.
- "Other (8)" becomes "Everything else" with the count moved to the legend value line.
- Receipt placeholder: remove until the feature exists (DESIGN.md open-gaps row stays as the record of intent).

Exit test: grep screens for string literals finds only accessibility labels and test IDs; no `[A-Z]{3} ` raw-code amount patterns; no ISO dates in rendered output.

### H2: Voice pass and acknowledgment moments

With strings centralized, rewrite them once, in one sitting, against the principles above. Concretely:

- **Home greeting**: time-of-day line above the hero ("Good evening" class, no name required, no exclamation). One line, `dim`, replaceable by a status line when something needs attention (offline, stale FX).
- **Acknowledgment moments**, quiet and rule-driven, rendered as a `caption`/`dim` line in existing cards, never a new surface: under budget at month-end, first entry logged, a full week of logging, safe-to-spend holding positive at mid-month. Hard cap: at most one moment visible per screen.
- **Empty states** get one warmer line while keeping the DESIGN.md skeleton (glyph, one body line, one tertiary action). "Nothing here yet" class copy becomes "Your first coffee, bus ticket, anything. Log it and this fills in."
- **Error copy** audit: imperative and corrective stays, blame never ("That didn't save. Try again" not "Invalid input").
- DESIGN.md "Tone & voice" section rewritten per the principles above; "Do's and don'ts" updated (the no-congratulation rule softens to no-celebration).

### H3: Add-entry progressive disclosure

The common case ("I spent money, category X") becomes: open, type amount, tap category, save. Everything else folds.

- Default state shows: mode control, amount well + keypad, category rail. That is all.
- Pocket defaults to last-used per mode (persisted locally); shown as a compact chip above save ("from BCA · today"), tap to expand the full picker rows.
- Date defaults today, note empty; both live behind the same disclosure chip row.
- Dr/Cr strip stays gated behind `showSides` exactly as now, inside the disclosed area.
- Guided empty states (no pocket yet, no category yet) keep their current behavior.
- Nothing is removed from the screen's capability; the full form is one tap away.

### H4: Motion and feel

Wire the motion tokens that DESIGN.md has specified since v1.1, with the already-installed `react-native-reanimated` 4.5 and the existing haptics taxonomy in `ui/haptics.ts`. No new dependencies.

- Press feedback: `press-scale` 0.97 at `duration-instant` on Button, ListRow, Chip, Fab (today press is tone-only).
- Sheet and dialog enter/exit: `duration-base`/`ease-standard` in, `duration-fast`/`ease-exit` out. FAB to add-sheet gets `ease-emphasized`, the one sanctioned emphasized transition.
- Number changes cross-fade at `duration-fast` (hero net worth, safe-to-spend). Never count up.
- Progress bars animate width at `duration-base`.
- Reduced-motion: keep opacity fades, drop transform and width animation, exactly per canon.
- Easing curves finally travel to code: `EASING` added next to `DURATION` in `tokens.ts`.

## DESIGN.md changes (one amendment, versioned 1.4)

1. Tone & voice section rewritten (principles above).
2. "Encouraging but not cheerful" becomes the acknowledge-never-celebrate rule with the moment cap.
3. New "Strings" subsection: catalog is the only source of user-facing copy; literals in screens are a smell.
4. Do's and don'ts: add "Do write time and enums as words a person says"; soften the no-congratulation line to no-celebration.
5. Open gaps table: motion row closes at H4; wording-coverage row closes at H1; receipt row notes placeholder removed pending feature.

## Non-goals

- Web implementation (canon binds it; code pass is separate).
- Locales/i18n (catalog enables it; English only now).
- Illustrations, mascots, celebration mechanics (explicitly rejected at the tone-ceiling decision).
- A second quick-add flow (rejected for progressive disclosure).
- Any backend or schema change. This RFC is presentation-layer only.

## Risks and tradeoffs

- **Full catalog is the expensive path.** Touches every screen; chosen over targeted expansion for one voice pass over all copy at once and locale-readiness. Mitigation: mechanical migration first (H1, no copy changes), voice rewrite second (H2, catalog-only diff).
- **Warmth drift.** Once greetings exist, future contributions may escalate toward cheerfulness. Mitigation: the banned list stays in DESIGN.md as hard rules, and the one-moment-per-screen cap is written into canon.
- **Last-used pocket default can post to the wrong pocket.** Mitigation: the chip always shows the target before save; save button never hides it.
- **Reanimated on the tab/FAB path** can regress performance on low-end Android. Mitigation: transforms and opacity only, no layout animation on list rows.

## Verification

- `tsc` clean, existing tests green after each workstream.
- H1 exit greps (above) run and recorded.
- Screenshot pass per screen in both wording modes and both themes; Boss reviews before web pass starts.
- Runtime verify on device is Boss's step (WMB native build), same as prior milestones.
