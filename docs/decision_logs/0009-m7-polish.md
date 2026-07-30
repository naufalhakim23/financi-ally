# 0009 — M7 Polish: charts, onboarding, non-default states, EAS

**Date**: 2026-07-31
**Status**: Decided
**Context**: M0–M6 shipped; the design system landed early in 0005. M7's remaining exit criteria (plan §9): charts, empty/onboarding states, opening balance, EAS build. The app had no way to create a pocket at all — only a `seedStarter()` hack inside the add-entry screen that created four hard-coded accounts with no opening balance.

## Decisions

### 1. Monthly trend gets its own endpoint, not N client calls
**Chose**: `GET /reports/monthly?months=6` → `MonthlySeries`. Boss's call.

**Rejected**: six parallel `/reports/cash-flow` calls from the client (zero backend change) and a local WatermelonDB rollup (offline-capable, zero requests). The local option diverges from the rest of the Reports screen, which is server-normalized through FX — two answers to "what did I spend" is worse than one round trip.

**Cost**: OpenAPI + service + handler + regen on both sides for one chart.

### 2. The endpoint loops `CashFlow` per month instead of one grouped query
**Chose**: `MonthlySeries` calls the existing, tested `CashFlow` once per month window.

**Rejected**: a single `date_trunc('month', …) GROUP BY` rollup. Faster, but it duplicates the FX-normalization path that CashFlow already owns — and a second normalization path on a money report is a correctness risk, not a performance win. At the 24-month ceiling this is ≤48 small indexed queries scoped to one user. Marked `ponytail:` with the upgrade path.

**Check**: `monthWindows` (the part that can silently drift — year rollover, day-31 timestamps, non-UTC zones) is unit-tested in `internal/reporting/service_test.go`. No database needed.

### 3. Charts hand-rolled on `react-native-svg`
**Chose**: `react-native-svg` (Expo-blessed) + ~150 lines in `src/components/charts.tsx`. Donut = one stroked `<Circle>` per slice via dash offsets; trend bars = plain Views (a bar is a rectangle; SVG buys nothing).

**Rejected**: `victory-native` — pulls in react-native-skia, a large native surface, and its styling fights the token system for two charts.

### 4. Charts carry their own categorical ramp
**Chose**: an 8-slot ramp documented in DESIGN.md, assigned by slot in fixed order, folding past 7 categories into "Other". Validated on the `#FFFFFF` card surface (worst adjacent CVD ΔE 9.1, normal-vision 19.6).

**Why**: the brand palette is deliberately neutral (decision 0005-1) and its status colors are semantically reserved — neither can encode series identity. Three ramp slots sit under 3:1 contrast against the surface, so every chart using it ships a labelled legend with name + value; identity is never color-alone.

### 5. Opening balances are real equity entries
**Chose**: `pocket-new.tsx` creates the pocket and, when an opening balance is given, an `Opening Balances` equity account (one per currency) plus a balanced entry — asset pockets debit the pocket / credit equity, liability pockets do the reverse.

**Rejected**: a starting-balance column on `accounts`. That is money from nowhere: it breaks the provable "balance = sum of posted lines" property the whole ledger rests on. One equity account *per currency* because an entry's legs balance per-currency (0003-2).

**Also**: one screen serves both jobs — `?first=1` marks the onboarding path and additionally seeds starter categories. A separate onboarding screen would have been the same form twice.

### 6. Sync status is a module store, not a context
**Chose**: `src/lib/syncState.ts` — a `useSyncExternalStore` store written by `sync.ts` (plain module code, no React) and read by the shell: a `↑ pending` chip in the header and a strip above the tab bar. Rejected records outrank transport failures, because a 422 needs the user, not a retry.

**Why not a context**: the writer isn't a component. Pending state comes from WatermelonDB's own `hasUnsyncedChanges` rather than a hand-kept counter.

### 7. EAS config only
**Chose**: `mobile/eas.json` with development / preview / production profiles + README run steps. Production `EXPO_PUBLIC_API_URL` is a deliberate `.invalid` placeholder so a store build can't silently point at nothing real.

**Not done**: `eas login` / `eas init` / the first build — they need Boss's Expo account.

## Open

- **Apple Sign-In** is still outstanding (README carried it from M1 to M7). Needs an Apple Developer account; plan §8 flags it as an App Store rejection risk.
- **Mobile runtime is still unverified** — the JS bundle builds clean (`expo export --platform ios`), but WatermelonDB's JSI adapter needs a dev build to actually run. Same gap as M3/M4/M5.
- Chart ramp has no dark-mode steps (tracked in DESIGN.md → Open Gaps).
