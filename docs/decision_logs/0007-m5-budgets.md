# 0007 — M5 budgets (retro log)

**Date:** 2026-07-30 · **Status:** shipped in commit `be8051a`. Backend +
mobile build clean; mobile runtime unverified (needs a dev build — WatermelonDB
is a native module).

> Written retroactively: M5 shipped without a decision log. Recorded here so the
> reasoning behind the budget model isn't lost.

## What landed

- **`internal/budget`** — monthly category targets: `Set` (upsert by
  `(user_id, account_id, period_month)`), list-with-spent, update, soft delete.
  `Set` validates through the ledger that the target account is an owned,
  non-archived **expense** account.
- **Spent-vs-target** is computed server-side from posted journal lines rather
  than stored, so a budget can never drift from the ledger it summarizes.
- **Mobile** — Budgets tab (create/edit/delete) plus the dashboard summary card.
- **Sync** — `budgets` is a synced, soft-deletable table; push routes through
  `budget.Set` so an offline-authored budget gets the same validation.

## Key decisions

- **Budgets are monthly and per-account, keyed on `period_month` (a date
  pinned to the 1st).** Rejected: arbitrary date-range budgets — every real
  usage is calendar-monthly, and a range model complicates both the unique key
  and the "what am I spending this month" question the dashboard asks.
- **Spent is derived, never denormalized.** A stored counter would need
  updating from every entry write, including sync pushes and (as of M6)
  scheduler posts. Aggregating on read is fast at personal-finance data volume;
  revisit only if a report query shows up hot.
- **Soft delete (migration 005)** rather than hard delete, because the sync
  protocol needs deletions to be *pullable* — a hard-deleted row can't tell
  other devices it's gone.

## Follow-ups

- Budget rollover / carry-over of unspent target: not modelled. Deferred until
  the product asks for it.
- Income-side targets (savings goals): out of scope for M5.
