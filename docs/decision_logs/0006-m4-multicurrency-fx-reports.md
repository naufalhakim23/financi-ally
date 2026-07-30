# 0006 — M4 multi-currency, FX job, and reports

**Date:** 2026-07-29 · **Status:** shipped. Build + tests + e2e verified.

## What landed

- **Multi-currency ledger.** `LineInput.Currency` (optional, defaults to entry
  currency) and `EntryInput.FXRate` (optional, for cross-currency entries).
  When `fx_rate` is set, the per-currency balance invariant is checked in-app
  via `money.Convert` (converted debits == credits denominated in the entry
  currency), and the DB trigger is relaxed for those entries (`fx_rate IS NOT
  NULL` skips the per-currency group check).
- **`internal/fx`** — daily FX rate refresh from frankfurter.app. Repo stores
  `(base, quote, day, rate, source)`; service uses a fallback chain for any
  missing pair: direct → inverse → cross via EUR → cross via USD. Rates are
  stored as `numeric` expressions (e.g. `1/15000`, `(1/15000)*(14000)`) that
  `big.Rat` can evaluate at query time via `AtOrBefore`.
- **`internal/reporting`** — Net Worth, Spending by Category, Cash Flow, all
  normalizing amounts to the user's `base_currency` via `money.Convert` and the
  FX service's nearest-as-of rate.
- **Sync support** — `pushEntry` passes `fx_rate` and per-line `currency`
  through to `ledger.Post` so sync-pushed entries also work.

## The load-bearing decision: app-level fx conversion

The DB trigger is the defense-in-depth layer. The primary invariant enforcement
for cross-currency entries lives in the application layer (`ledger.Post`), which
uses `money.Convert` to harmonise heterogeneous line currencies into the entry
currency before comparing debits vs credits. This is necessary because the
trigger operates on raw `amount_minor` values grouped by `journal_lines.currency`
— for a cross-currency entry, each line is in a different group and would
trivially not sum to zero without the `fx_rate IS NOT NULL` bypass.

Rejected: computing the cross-currency balance inside the trigger (too
complex, embeds conversion logic in SQL); using a separate cross-currency
validation trigger (two triggers on the same table is harder to reason about).

## Key decisions

- **Rates stored as expressions, not pre-computed floats.** `big.Rat.SetString`
  can parse `"1/15000"` and `"(1/15000)*(14000)"`, so we store fallback rates
  as evaluable expressions. This avoids float-to-decimal conversion loss and
  keeps the storage scheme uniform (all rates are rational expressions).
  Conversion uses `new(big.Rat).SetString(rate)` → `Mul` → half-up rounding.
- **Frankfurter.app is the sole data source.** No multi-provider abstraction
  yet; swap is a new source implementation. Frankfurter is free, no API key,
  covers 31 currencies vs EUR. Refresh is daily (not real-time), which is fine
  for personal finance.
- **User base_currency is the report normalisation target.** Defined at
  registration, stored on `users.base_currency`. All report amounts include
  `raw_minor` (original), `base_minor` (normalised), and `currency`.
- **Refresh is triggered by an explicit endpoint, not a cron.** The `/fx/rates/refresh`
  endpoint exists for manual or scheduler use; a system cron or serverless job
  can call it daily. `REFreshSchedule` in config is reserved for future
  in-process scheduling but unused.
- **`journal_lines.currency` is now populated for all entries.** Previously it
  was non-nullable (set to the entry's currency). Now it explicitly tracks the
  line's currency (same as entry for single-currency entries; different for
  multi-currency ones). The alert reader will notice that the very first
  migration already had `NOT NULL` on that column — this is not a schema change,
  just a correct usage shift from "always equals entry currency" to "carries
  the line's actual currency."
- **Sync repo includes `fx_rate` in entry columns.** The sync `tableColumns`
  for `entries` includes `fx_rate` so WatermelonDB push/pull transmits it.

## Verification

Backend: `go test -p 1 ./internal/...` passes (auth, config, fx, ledger, money,
sync). `make vet` clean. `make build` compiles. Curl e2e:
1. Register → create IDR accounts → post single-currency entry (5M IDR) ✅
2. Refresh FX rates → 90 rates loaded from frankfurter.app ✅
3. Query EUR/IDR rate → 20,576.77 from frankfurter ✅
4. Create USD account → post cross-currency entry ($10 spend, IDR 205,768
   expense via fx_rate) ✅
5. Reports: net worth (5M IDR), spending (Food 205,768 IDR), cash flow
   (income 5M, expense 205,768, net 4,794,232) ✅

Mobile: no mobile changes needed (M4 is backend-only — the mobile app uses the
same API contracts, with `currency` and `fx_rate` as optional fields; WatermelonDB
schema supports them transactionally).

Relates to [[0005-design-system]], [[0004-m3-sync]], [[0003-m2-ledger]].
