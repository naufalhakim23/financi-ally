# RFC 0002: Sea-glass visual identity

- Status: Draft (awaiting Boss approval)
- Date: 2026-08-17
- Scope: mobile first; tokens bind both clients, web code pass follows
- Companion: RFC 0001 (humane wording and flows). This RFC owns the looks; 0001 owns the words.
- Evidence: `design-explore/01-humane-visual/` (brief, 3 prototyped variants, Boss's pick, DECISION.md)

## Problem

DESIGN.md v1.3 is precise and calm but visually cold: cool slate neutrals, zero brand hue,
near-black primary carrying every action. Boss's verdict on the product: "still felt like not
for humans." Three HTML variants were prototyped against a warm-but-calm brief
(Headspace softness, Stripe polish); Boss picked variant B, sea-glass, outright.

## The direction in one paragraph

Keep everything v1.3 got right: tonal surfaces, hairline borders, IBM Plex Mono numerals,
strict semantic color, restraint. Warm the system underneath it: the cool slate neutral ramp
becomes a warm gray ramp, a teal accent enters as punctuation (never paint), radii soften one
step, and the hero surfaces carry light. The identity sentence moves from "private banking
statement" to "a well-made tool that is glad you opened it."

## Token changes (DESIGN.md v1.3 -> v2.0)

Values below are lifted from the winning prototype (`variant-b-sea-glass/`), already
AA-checked in light mode.

### New: accent family (brand hue, light mode)

| Token | Value | Use |
|---|---|---|
| `accent` | `#0E8A7B` | fills only: FAB, tab-active glyph+label, selected chip, primary switch track |
| `accent-strong` | `#0B7268` | accent as text: links, tertiary buttons (5.2:1 on surface) |
| `accent-pressed` | `#0A675C` | pressed fills |
| `accent-wash` | `#EBF4F2` | tinted containers, selected-state backgrounds |
| `accent-edge` | `#CDE4E0` | borders on accent-washed containers |

Separation rules, non-negotiable:
- Accent never colors an amount, a sign, or anything money-semantic. Amounts keep
  ink/success/error exactly as v1.3.
- Success green (`#16A34A`/`#15803D`) keeps income/gains only. The two hues never sit as
  fill-on-fill neighbors; where a green figure meets accent chrome, the hairline or surface
  separates them.
- `primary` (near-black) remains the primary button and high-emphasis fill. Accent does not
  replace primary; it replaces the places blue and gray chrome used to sit. One accent moment
  per screen region, same discipline as the old one-primary rule.

### Changed: neutral ramp goes warm

| Role | v1.3 (cool slate) | v2.0 (warm gray) |
|---|---|---|
| `background` | `#F2F3F7` | `#F6F5F3` |
| `surface` | `#FFFFFF` | `#FFFFFF` (unchanged) |
| `surface-container` (wells) | `#F0F1F6` | `#F1EFEC` |
| `surface-container-high` (tracks) | `#E8EAF2` | `#E8E5E0` |
| `outline` | `#E2E6F0` | `#E5E2DD` |
| `outline-variant` | `#F0F1F6` | `#EFEDE9` |
| `outline-strong` | `#C0C7DA` | `#CFCBC4` |
| `ink` | `#1A1F2E` | `#201E1B` |
| `dim` | `#5A6379` | `#5D5952` |
| `faint` | `#737C91` | `#79746C` |
| `disabled` | `#98A1B5` | `#A8A29A` |

`primary`/`primary-pressed` re-derive from the new ink (`#201E1B` family). The raw `palette`
neutral ramp in DESIGN.md is regenerated to warm equivalents; semantic aliases keep their names,
so screens and `tailwind.config.js` keys do not rename, values only.

### Changed: info role retires from chrome

v1.3 used info-blue for links, focus-ring and tertiary buttons. Those move to accent
(`accent-strong` text, accent focus ring). `info` (`#2563EB` family) survives with one job:
genuinely informational semantics — transfer amounts and neutral notices — so blue now carries
meaning with the same strictness as green/red/amber.

### Changed: radii, one step softer

| Element | v1.3 | v2.0 |
|---|---|---|
| Cards, sheets | 20px | 24px |
| Buttons, inputs, keypad keys | 16px / 12px | 18px |
| Icon tiles | 16px | 14px (prototype value; tiles read tighter at 40px) |
| Pills, badges, FAB | full | full (unchanged) |

### Changed: hero light

Hero surfaces (Total money card, cash-flow card) may carry a barely-there linear gradient,
white to `#F3F8F7` (accent-tinted at the low end), reading as light on glass. Constraints:
only on `surface` hero cards, never behind lists or forms, never more than one per screen,
and the "no gradients" rule stays for every other element. Dark mode: no gradient; tonal
ladder only.

### Unchanged, deliberately

Outfit + IBM Plex Mono, the full type scale, spacing scale, elevation model, hairline
borders, motion tokens (wiring is RFC 0001 H4), Lucide-only iconography, all wash/edge/base
status trios, chart ramp and its legend rules, one-primary-per-screen.

### Dark mode

Not prototyped this round. At the DESIGN.md v2.0 write-up: warm-gray dark ramp derived from
the same families (background near `#151311`, surfaces warm dark grays), accent lightened to
hold 4.5:1 on dark surface (target near `#3FB3A2`), each pairing AA-validated before the
amendment lands. Dark stays first-class: same semantic names, no deferral.

## Component deltas (mobile implementation)

Where the code changes when this lands, mapped to the atomic standard in
`mobile/src/components/ui/`:

- `tailwind.config.js` + `tokens.ts`: neutral ramp swap, accent family added, radii updated.
  Semantic names stable, so this is mostly a values-only diff.
- `core.tsx`: Button tertiary and link color to `accent-strong`; Chip selected state to
  accent fill; Fab to accent; focus ring to accent.
- `nav.tsx`: tab-active to accent (was primary).
- `forms.tsx`: switch on-track to accent; segmented control active state unchanged (ink).
- `charts.tsx`: single-series emphasis bar may use accent instead of primary; ramp untouched.
- Hero cards on Home and Reports: gradient variant of Card (one new prop, not a new atom).
- Screens: no structural changes in this RFC; RFC 0001 H3 owns the add-entry restructure.

## Rollout

1. DESIGN.md v2.0 amendment (tokens above + dark derivation + prose update; "Retired
   directions" records the cool slate ramp and chrome-blue).
2. Token swap in `mobile/` (config + tokens.ts), screenshot diff of all screens both themes.
3. Component deltas (accent adoption), screenshot pass again.
4. Web follows: `web/src/index.css` var swap, same order.
Coordination: if RFC 0001 implementation runs first, its screens land on v1.3 tokens and
inherit the swap transparently; no sequencing hazard between the two RFCs.

## Risks and tradeoffs

- **Teal vs success green proximity.** Closest pair of the three candidates; mitigated by the
  separation rules (accent never on amounts, fills never adjacent) and by teal being visibly
  blue-leaning at the chosen values. Verified acceptable in the prototype; re-check in dark.
- **Warm neutrals shift perceived contrast.** Every text pairing re-validated at amendment
  time, not assumed from v1.3.
- **Accent creep.** The failure mode of adding a brand hue is it spreading to every surface.
  The punctuation rule and one-accent-moment-per-region rule go into DESIGN.md do's and
  don'ts as hard lines.
- **Rejected alternatives** recorded in DECISION.md: A morning-air (indigo + cream, drifted
  too soft), C plum-hearth (accent-led, spent the scarce color budget).

## Verification

- AA table for every text-on-surface pairing, both themes, attached to the DESIGN.md v2.0 PR.
- Screenshot diff per screen per theme after the token swap and after component deltas.
- Boss device pass before web begins.
