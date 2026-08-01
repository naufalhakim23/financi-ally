# 0011 — Guest mode: using the app without an account

**Date**: 2026-08-01
**Status**: Decided
**Context**: The app opened on a sign-in wall. Boss: "user always needed to login — how about user can just use it without the needed to logged in?" Since M3 the mobile client has been offline-first: entries, journal lines and accounts are written to WatermelonDB and reconciled through `/sync` afterwards. The wall was therefore a policy, not a technical requirement.

## Decisions

### 1. Guest is local-only — no anonymous server account
**Chose**: guest mode holds no token and never calls the server. `syncDatabase()` returns immediately when `isGuest()`.

**Rejected**: minting an anonymous user server-side from a device id. It buys sync from the first tap, and costs a new `/auth/anonymous` endpoint, orphan-row cleanup for every install that never converts, an abuse surface with no email to rate-limit against, and account-merge logic at sign-up. Local-only needed **zero backend changes**.

**Cost**: a guest has no multi-device access and no cloud backup. Losing the phone loses the data. Stated plainly on the welcome screen and in the More tab.

### 2. Sign-up migration is free, because nothing was ever synced
A guest's rows all sit at WatermelonDB `_status: "created"`, so the first sync cycle after registration pushes the entire history up as a normal create batch. `sync.Service.PushChanges` already applies `accounts` before `entries` ("accounts first — entries reference them"), so foreign keys resolve on the way in. No merge code, no import path, no id remapping.

The only real coupling: `register.tsx` prefills the base-currency field from `guestCurrency()`. Without it the new account defaults to IDR and every guest figure silently reprices.

### 3. Server-backed screens are locked, not reimplemented
Reports, the spending plan, repeating entries and Books are server-computed. In guest mode their More-tab rows read "Sign in to unlock", show a lock glyph, and route to `/register`.

**Rejected**: reimplementing budgets and reports against the local journal. It would duplicate `reporting.Service` math on-device — a second implementation of numbers about money, which is the one place a divergence is expensive. Locking them also makes the value of an account concrete at the moment the user wants it.

FX rates and the monthly series get `enabled: !guest` instead: both already degrade to `EMPTY_RATES` / `points: []`, so the home and buckets screens lose a caption and a chart, not their content.

### 4. Signing into an **existing** account asks before touching the data
A guest with local entries who signs in (rather than registers) hits a `Dialog`: "Keep them" (default, safe — the entries push into the account) or "Start fresh" (destructive — discard). Discard reuses `markLedgerStale()`, the existing "this local database belongs to a book we can no longer read" flag, which wipes before the next pull.

**Rejected**: always keeping (duplicates pockets and categories into an already-populated ledger) and always discarding (silently deletes work). Declining the dialog — including dismissing it — keeps the data; only the explicit destructive button drops it.

### 5. Guest state lives in a module store, not the auth context
`src/lib/guestStore.ts` mirrors `ledgerStore.ts`: a module-level store with `useSyncExternalStore` for React. `sync.ts` is plain module code with no React around it and must read guest state on every cycle — through a context it could not.

`useAuth()` gained `guest: boolean` and `baseCurrency: string`. The ten screens that read `user?.base_currency ?? "IDR"` now read `baseCurrency`, so guest mode needed no per-screen fallback.

## Not built

- Local budgets and local reports for guests — add when guests ask for them.
- A settings row to change the guest base currency after onboarding.
- Automated tests: the mobile package has no test runner, and standing one up for a store that reads and writes one string is more scaffolding than logic. `tsc --noEmit` is clean.
