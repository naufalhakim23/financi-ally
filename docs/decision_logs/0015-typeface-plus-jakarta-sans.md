# 0015 — UI typeface: Plus Jakarta Sans, and the three type-scale fixes it exposed

Date: 2026-08-22
Status: accepted
Scope: `DESIGN.md` (v2.0 → v2.1), `mobile`, `web`. No backend, schema or contract change.
Companion: `docs/rfc/0002-sea-glass-visual.md` — this is the typeface half of the same brief.

## Context

RFC 0002 answered "still felt like not for humans" by warming eleven neutrals,
adding a teal accent, softening radii one step, and putting a near-invisible
gradient on hero cards. Under **Unchanged, deliberately** it listed "Outfit +
IBM Plex Mono, the full type scale".

That was the wrong thing to hold fixed. In a text-dense UI the typeface is the
largest single carrier of the quality the brief was asking for, and Outfit is a
geometric display face: circular bowls, near-monoline strokes, minimal skeleton
differentiation. It looks its best at 40px. This app sets **four roles at 12–13px**
(`label`, `caption`, `overline`, and every list-row subtitle in `caption`), which
is exactly where the geometric genre flattens first.

It was also a genre mismatch with its own partner. DESIGN.md chose IBM Plex Mono
over JetBrains Mono, DM Mono, Spline Sans Mono and Recursive specifically for
"its humanist skeleton and warmer terminals" — then set every label beside those
numerals in the coldest sans genre available. Every list row in the app was a
humanist mono amount next to a geometric sans label, disagreeing about what kind
of object it was.

## Decisions

### 1. Plus Jakarta Sans replaces Outfit

**Chose**: `@expo-google-fonts/plus-jakarta-sans` at 400/500/600/700, and the
matching Google Fonts link on web. Three reasons, in order of weight:

1. **Humanist, so it agrees with the mono.** The skeleton variation and terminal
   treatment sit in the same register as Plex Mono. The row stops arguing with
   itself.
2. **It survives 12–13px.** Tighter fit and more differentiated letterforms than
   Outfit at the sizes four of our roles actually live at.
3. **It is from here.** Drawn by Tokotype and commissioned as the official
   typeface of the city of Jakarta. For a tracker whose base currency is usually
   IDR, that is identity rather than decoration — and no competitor is set in it.

**Rejected**: *IBM Plex Sans* — the only genuinely *designed* pair with our mono
(same team, same skeleton), and the safer choice. Passed over because it reads
corporate and carries an IBM association; it delivers "well-made" and is cool on
"glad you opened it", which was the half of the brief still outstanding. Keep it
as the fallback if Plus Jakarta Sans fails device testing.
*Public Sans / Source Sans 3* — best pure small-size legibility, no personality
to spend on the brief. *Figtree* — warmer geometric, but still geometric, so it
treats the symptom and not the genre mismatch. *Inter* — the most-used interface
face in the world; makes the product look like every other product. *Lato* —
disqualified outright: Google Fonts ships 100/300/400/700/900, and our scale is
built on 500 and 600.

**Cost**: Plus Jakarta Sans ships the largest files of the shortlist; budget a
few hundred KB of binary growth. It is a compatible pair with Plex Mono, not a
designed one — verified by eye in the specimen, not by shared metrics.

### 2. IBM Plex Mono is unchanged

The mismatch was always on the sans side. Plex Mono's tabular figures are still
the reason money columns line up, and nothing in the review argued against it.
A superfamily move (Fira Sans + Fira Mono, Red Hat Text + Red Hat Mono) would
have bought metric harmony at the cost of the numeral face, which is the wrong
trade for a ledger.

### 3. `body` drops from weight 500 to 400

`body` 500 against `body-strong` 600 is a one-step gap, and that pair was
carrying the whole title-versus-subtitle hierarchy across the app. One step is
close to invisible in any sans at 15px and worse on Android's renderer. 400/600
doubles the perceptual gap at no cost — the 400 weight was already being loaded
and used at exactly one call site.

`caption` deliberately **stays at 500**: at 12px in `faint` it needs the weight,
and it has no `-strong` sibling to separate from, so lightening it would cost
legibility and buy nothing. 25 call sites moved `font-sans-medium` →
`font-sans`; the 33 `text-caption font-sans-medium` sites were left alone.

### 4. `overline` and `mono-meta` move 11px → 12px

The Typography prose has read "**Never** set UI text below 12px" since v1.1
while the token scale defined two roles at 11px, in the same document. Under
DESIGN.md's own precedence rule ("when prose and tokens disagree, tokens win")
the rule was dead text. Both roles moved to 12px, line-heights and tracking
recomputed (`overline` 14px/0.96px, `mono-meta` 16px). Nothing in the scale sits
below 12px now, and the rule is enforceable.

These are the smallest and — because both roles normally render in `faint` — the
lowest-contrast strings in the product. They carry every section label, every tab
label, every running balance and every rate timestamp.

### 5. Sans family keys go face-agnostic

**Chose**: `Sans` / `Sans-Medium` / `Sans-SemiBold` / `Sans-Bold` in
`useFonts()`, matching the existing `Mono` convention.

The mono keys were abstracted in v1.1 precisely so a numeral-face swap would
touch one file. The sans keys were left as the literal string `Outfit`, which is
the only reason this change had to edit `tailwind.config.js` at all. Fixed while
the file was open: the next UI-face move touches `app/_layout.tsx` and nothing
else.

## Consequences

- Every screen changes appearance. No layout, spacing or component structure
  changes, and no class name changes except the 25 `body` weight sites.
- `overline` at 12px is 1px taller per line; section labels and tab labels gain
  about 1px of height. Tab bar and card headers were measured with slack and
  absorb it, but this is the one change with a layout footprint — check the tab
  island and `SectionLabel` rows on a small device.
- Web gets the face and the two size changes. The web body-weight sweep is not
  applicable — web does not use the `text-body font-medium` pairing — and the
  broader web code pass stays as scheduled in RFC 0002 rollout step 4.
- Bundle grows by the difference between the two families' TTFs.

## Verification

Unrun in the authoring environment (no package registry access). Before merge:

1. `yarn install && yarn check` in `mobile/` — typecheck, token drift, ESLint.
2. Screenshot diff every screen in both themes.
3. Device pass at the largest accessibility font size. DESIGN.md claims Dynamic
   Type to 200% and `ListRow` has known structural obstacles to it; a typeface
   swap invalidates every prior measurement, so this is the run that matters.
4. Confirm no Outfit reference survives outside `docs/` history.
