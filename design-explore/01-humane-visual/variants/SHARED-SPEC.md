# Shared spec: every variant renders exactly this

Content is identical across variants so Boss compares treatment, never data. Files per variant
folder: `index.html` (Home), `add-entry.html`, `reports.html`.

## Frame

- Mobile viewport simulation: a centered phone frame ~390px wide, min-height ~844px, on a
  quiet page background so it reads like a device on a desk. The frame scrolls its content.
- Page `<title>`: `Variant {A|B|C} — {personality} — {Home|Add entry|Reports}`.
- Floating nav (fixed, top-right, outside the phone frame): links to the other two pages of
  this variant, plus the same page in the other two variants (relative paths, folders:
  `variant-a-morning-air`, `variant-b-sea-glass`, `variant-c-plum-hearth`).
- Self-contained: Tailwind Play CDN, Google Fonts (Outfit 400/500/600/700 + IBM Plex Mono
  400/500/700), icons as inline SVG (Lucide paths). No other network assets, no build step.
- Real hover/focus/pressed states on buttons, chips, keypad keys, list rows (CSS).

## Non-negotiables (from DESIGN.md v1.3, all variants)

- Every numeral in IBM Plex Mono. Amounts formatted grouped: `IDR 128,450,000`. Sign and
  semantic color on flow amounts: green income `+`, red expense `−` (U+2212). Neutral
  balances in ink, unsigned.
- Green/red/amber strictly semantic. Accent hue never used for income/expense/caution.
- Bottom tab bar: Home · History · [FAB +] · Buckets · More. FAB breaks the top edge.
- Sentence case, no exclamation marks, no emoji. Lucide-style line icons only.
- WCAG AA text contrast.

## Home (`index.html`)

Top: book pill "Personal" · search icon · avatar "NA".
Greeting moment (expressive type, per variant): "Good evening" with quiet secondary line
"Sunday, August 17".
Hero: label "Total money", amount `IDR 128,450,000`, small `+2.1% this month` in success color,
6-month mini trend (bars or line, single-series, accent or primary per variant).
Range chips: 6M (active) · 1Y · All.
Acknowledgment line (quiet, dim): "Three weeks of logging without a gap."
Section "Buckets":
- Cash and banks — `IDR 94,200,000` (children when expanded: BCA 62,400,000 · Jago
  24,800,000 · Cash on hand 7,000,000; render Cash and banks expanded)
- Foreign — `≈ IDR 18,650,000` with mono-meta line "USD 1,150 · converted at cached rate"
- Spending this month — `IDR 6,850,000 of 9,000,000` with progress bar (76%, warning zone)
- Owed — `−IDR 2,400,000`
Safe to spend card: `IDR 2,150,000` with "14 days left in August".
Recent section, 3 rows: Kopi Tuku −28,000 (Eating out, 5:12 pm) · Gojek −35,000 (Transport,
2:40 pm) · Groceries at Superindo −214,500 (Groceries, yesterday).
Non-default state to include: the Foreign bucket carries the stale-rate warning meta line
(already in the data above), styled per variant.

## Add entry (`add-entry.html`)

Progressive-disclosure layout (RFC 0001 H3): this page shows the *common case*.
Segmented control: Out (active) · In · Move.
Amount well: `IDR 28,000` being typed (cursor or active styling).
Category rail (horizontal chips with tinted glyph tiles): Eating out (selected) · Groceries ·
Transport · Fun · Bills · + New.
Compact defaults chip row: "from BCA · today" with a chevron (this is the disclosure).
Below it, render the disclosure OPEN as the page's non-default state: expanded rows for
"Out of: BCA", "Date: Today", "Note: add a note" visible so Boss sees both states at once.
Numeric keypad (0-9, 000, backspace), then full-width Save button ("Save entry").
Guided-empty-state is NOT this page's job.

## Reports (`reports.html`)

Title "Reports", subtitle "August".
Cash flow card: In `+IDR 32,000,000` (green) · Out `−IDR 6,850,000` (red) · Net
`+IDR 25,150,000`.
Spend by category: donut + legend-with-values (category color presence per variant):
Groceries 2,400,000 · Eating out 1,850,000 · Transport 950,000 · Bills 850,000 · Fun 500,000 ·
Everything else 300,000.
Monthly trend: 6 bars (Mar-Aug), Aug emphasized.
Non-default state: one final card "Net worth over time" rendered as its EMPTY state, copy:
"A few more weeks of entries and this chart draws itself." styled per the variant's
texture-on-emptiness language (tinted composition, no illustration/mascot).

## Per-variant accent families

- A morning-air: warm periwinkle-indigo (~#5B5BD6 family, tune freely), warm cream neutrals.
- B sea-glass: teal (~#0E8A7B family, tune freely; keep clearly apart from success green),
  warm-gray neutrals.
- C plum-hearth: plum/mulberry (~#8E4585..#A0426E family, tune freely; keep clearly apart
  from error red), neutrals may warm toward mauve.
