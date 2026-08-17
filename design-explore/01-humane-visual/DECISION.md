# Decision: variant B, sea-glass

Date: 2026-08-17. One round; Boss picked B outright.

## What won

Stripe-leaning polish where warmth comes from tuning, not rework. Teal accent
(#0E8A7B fills, #0B7268 text, 5.2:1 AA) used strictly as punctuation: FAB, tab-active,
selected chip, links, focus. Warm-gray neutral ramp (#F6F5F3 background, #201E1B ink,
#E5E2DD hairlines) replaces the cool slate ramp. v1.3 hairline borders retained. Radii one
step softer: cards 24px, buttons/keypad 18px, icon tiles 14px. Hero carries a barely-there
white-to-#F3F8F7 tonal gradient reading as light. Empty state: quiet accent-wash card,
dotted grid, solid-to-dotted teal projection line.

## Why (against the others)

- A (morning-air, indigo + cream) was the softest but drifted furthest from the precise,
  banking-statement core; cream neutrals read less crisp for money.
- C (plum-hearth) put the most personality on screen but the accent led everywhere,
  spending the color budget the v1.3 identity deliberately keeps scarce.
- B keeps every v1.3 structural virtue (hairlines, tonal depth, mono numerals) and warms
  the system underneath them, so the migration cost is the lowest of the three.

## Notes carried into the RFC

- Teal sits nearest to semantic success green of the three accents; the RFC pins the
  separation rules (accent never on amounts, green never on chrome).
- B drops info-blue from chrome: links and focus ring run on accent. Info hue's remaining
  job (transfers, neutral notices) is settled in RFC 0002.
- Dark-mode teal + warm-gray ramp not prototyped; derived and AA-validated at the
  DESIGN.md v2.0 amendment.

Full spec: docs/rfc/0002-sea-glass-visual.md. Prototype: variants/variant-b-sea-glass/.
