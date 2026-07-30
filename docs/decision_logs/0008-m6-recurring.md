# 0008 — M6 recurring transactions (RRULE scheduler)

**Date:** 2026-07-30 · **Status:** shipped. Backend build + `go vet` + full test
suite green against a real Postgres; mobile `tsc --noEmit` clean. Mobile runtime
still unverified (needs a Boss dev build — WatermelonDB is a native module).

## What landed

- **`internal/recurring`** — rules (iCalendar RRULE + a JSONB entry template),
  CRUD, and a sweeper that materializes due occurrences into posted entries via
  `ledger.Post`, so a scheduled entry passes exactly the same balance invariant
  and ownership checks as a manual one.
- **Migration 007** — `recurring_rules`. **Migration 008** —
  `entries.recurring_rule_id` + a partial unique index on
  `(recurring_rule_id, txn_date)`, and `last_error` / `last_error_at` on the rule.
- **Scheduler** in `cmd/server` — interval ticker, runs once at boot to cover
  downtime, configurable via `RECURRING_ENABLED` / `RECURRING_INTERVAL` /
  `RECURRING_TZ`.
- **REST + sync** — `/recurring` CRUD, `/recurring/trigger`, and
  `recurring_rules` as a synced soft-deletable table (pull + push).
- **Mobile** — schema v2 + migration, `RecurringRule` model, Recurring tab
  (rrule built from plain "how often / which day / how much" choices).

## The load-bearing decision: idempotency belongs in the database

An occurrence is identified by `(rule, date)`, and that pair is a partial unique
index. `ledger.Post` maps the resulting `23505` to `ErrDuplicateEntry`, which the
sweeper reads as "already done" — it advances the rule and posts nothing.

Rejected: checking "did I already post this?" in application code before
inserting. That is a TOCTOU race between two scheduler ticks and is simply wrong
the moment a second replica runs — exactly the deployment shape this app should
be able to grow into. The index is also what makes the manual trigger endpoint
safe to hammer.

This came out of a real defect: the first M6 cut had no guard, and a rule
re-posted the same entry on **every tick** (~96 duplicates/day at a 15-minute
interval). Two independent bugs produced it, and both are now regression-tested:

1. **`next_run` never advanced.** Occurrence dates were truncated to midnight,
   but a bare `FREQ=DAILY` inherits DTSTART from the *creation time of day*, so
   "next occurrence after midnight of day D" resolved back to day D.
   Fix: pin DTSTART to midnight in the scheduler's zone (`parseRule`) and search
   strictly after the *end* of the posted day (`endOfDay`), so an occurrence
   always lands on a later date whatever time components the rule carries.
2. **Entries posted a day early.** The due-cutoff was `today + 24h` with a
   `next_run <= cutoff` comparison, which swept in tomorrow. Fix: cutoff is
   `today`.

## Key decisions

- **Validate at write time, not at every tick.** `Create`/`Update` check the
  rrule parses, the template balances (debits == credits), and every referenced
  account exists, is unarchived, and matches the template currency. Previously a
  rule that could never post was accepted with a 201 and then failed silently
  into the log forever. A rule that goes bad *later* (account archived) records
  `last_error` on the rule and surfaces it in the UI.
- **A failed occurrence does not advance `next_run`.** The entry is still owed:
  a transient failure self-heals on the next sweep, a permanent one stays
  visible. The alternative — skipping — silently loses a rent payment.
- **Catch-up posts every missed occurrence in one sweep**, capped at
  `maxCatchUp` (366). One-per-tick would take a day to recover from a day of
  downtime; uncapped, a badly backdated rule would post thousands of entries.
- **The manual trigger is scoped to the caller** (`MaterializeDueForUser`).
  The first cut swept *all* users' rules for any authenticated caller — no data
  leak, but one tenant could force posts into another's ledger.
- **Recurring is single-currency.** A cross-currency rule needs a rate resolved
  per occurrence; the template rejects a line currency that differs from the
  template currency rather than storing a rule the ledger would refuse anyway.
- **Server owns scheduling; the client only owns the definition.** Push accepts
  a rule's `rrule`/`template`/`active`; `next_run`/`last_run` are computed
  server-side. A device that's been offline for a week must not decide what was
  owed while it slept.
- **`template::text` on sync pull.** WatermelonDB columns are scalars, so the
  JSONB template crosses as a JSON string and the model parses it.
- **One server-wide timezone, not per-user** (`RECURRING_TZ`). "The 1st of the
  month" is a calendar question and must not follow the host's zone by accident.
  Per-user zones need a `users.timezone` column and a per-user sweep — worth it
  when the product serves more than one region, not before.

## Verification

`DATABASE_URL=… go test -p 1 ./...` — green, including:

- `TestMaterializeDue` — one entry, dated **today**, then repeated sweeps are
  no-ops (the regression test for both duplicate-posting bugs).
- `TestMaterializeIsIdempotentPerOccurrence` — rewinds `next_run` to an
  already-posted date; the DB guard, not the advance logic, prevents the dupe.
- `TestMaterializeCatchesUpMissedOccurrences` — 4 backdated days, one per date.
- `TestMaterializeDueForUserIsScoped`, `TestMaterializeRecordsFailure`,
  `TestUpdateRecurringRule`, plus `sync.TestPushPullRecurringRule`.

## Follow-ups

- Mobile runtime verification (dev build) — carried over from M3/M5.
- Pause/resume toggle in the UI: the API supports `active`, the screen only
  displays it.
- Income/transfer-shaped rules: the screen builds expense-shaped templates
  (debit category, credit pocket); the backend accepts any balanced template.
- Per-user timezones (see above).
