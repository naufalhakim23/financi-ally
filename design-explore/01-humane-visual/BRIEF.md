# Brief: Humane visual pass (DESIGN.md v1.3 -> v2)

Date: 2026-08-17. Mode: refine, not fresh. DESIGN.md v1.3 stays the structural base
(tonal surfaces, hairline borders, mono numerals, semantic color discipline); this round
finds the warmth it is missing.

## Boss's words

- The app "still felt like not for humans" (origin of the whole humane pass, RFC 0001 covers wording).
- Visual direction, settled 2026-08-17:
  - Identity move: **add a brand accent hue** (current system has zero brand color, near-black primary only).
  - Visual moves, all four: **softer, rounder, airier** · **category color presence** ·
    **expressive type moments** · **texture on emptiness**.
  - Tone ceiling from RFC 0001: **warm but still calm**. No confetti, no streaks, no emoji,
    no illustrations/mascots.

## Product and audience (carried from DESIGN.md v1.3)

Offline-first personal expense and budget tracker, double-entry under the hood, multi-currency,
IDR base typical. One person managing their own money, on their phone, often at the moment money
just moved. Mobile first; web follows canon later.

## Feel

- Should feel: warm, calm, precise (trustworthy carries over from v1.3).
- Must not feel: sterile, corporate-terminal, gamified.

## References

- **Headspace / Calm**: soft warmth. Warm neutrals, generous air, gentle shapes. Calm as a literal design language.
- **Stripe**: polished trust. Impeccable type hierarchy, restrained accent use, professional warmth.
- Anti-reference (implied by tone ceiling): gamified spending apps, streak-driven fintech.

## Hard constraints

- Green = income/positive only. Red = expense/negative only. Amber = caution only. Never brand, never decoration.
- The accent hue must not collide with those three; info-blue may be retuned to make room.
- IBM Plex Mono for every numeral stays. Outfit stays unless a variant argues otherwise convincingly.
- WCAG AA on every text pairing, both themes. Dark mode remains first-class.
- Lucide icons, no emoji.

## Round shape

- 3 variants x 3 pages (Home, Add-entry, Reports), mobile frame, self-contained HTML.
- Each variant carries a **different accent family** so hue and treatment get compared at once.
- Same content across variants: same names, same amounts, same August data.
