# 0010 — M8 Shared Ledgers: books, membership, join codes

**Date**: 2026-08-01
**Status**: Decided
**Context**: M0–M7 shipped as a single-user app. The plan (§6) deferred sharing with "single-user now, `user_id`-scoped schema … defer; schema is ready for it". Boss picked shared household books as M8, with Splitwise-style splitting to follow as M9. This log covers M8 only.

## Decisions

### 1. Tenancy moves from `user_id` to `ledger_id`, not to a set of user ids
**Chose**: a `ledgers` table (a *book* of accounts) plus `ledger_members`. `accounts`, `entries`, `budgets` and `recurring_rules` swap their `user_id` scope column for `ledger_id`.

**Rejected**: keeping `user_id` and rewriting every `WHERE user_id = $1` to `= ANY($1)` over a membership set. It looks like the smaller migration and isn't: writes still need an owner picked from the set; `UNIQUE(user_id, type, name)` would let two members each create their own "Groceries" in one household; budgets would stay per-member when a household wants one target per category; and every query changes either way.

**Why it stayed cheap**: the codebase threaded tenancy as a *single scalar* from `Principal` → handler → service → repo, in ~196 call sites that mostly pass it through. Swapping which scalar is a rename plus one resolver. Had tenancy been a filter object or scattered inline SQL, this milestone would have been a rewrite.

**Cost**: migration 009 touches every money table, and a down-migration that collapses household rows onto the book creator is lossy by construction.

### 2. The active book travels in an `X-Ledger-Id` header
**Chose**: a request header, resolved to a `household.Scope` by middleware and folded onto the `Principal`. Absent header = the caller's personal book.

**Rejected**: a JWT claim — switching books would force a token re-issue, and a stale token would silently write to the wrong book. Also rejected: `users.active_ledger_id` — server-side state for a client-side choice, which breaks the moment two devices sit in different books.

**Consequence**: one indexed lookup per authenticated request. Marked `ponytail:` in `household.Repo.Scope` with the memoize-and-bust upgrade path.

### 3. A membership miss is 403, and "no such ledger" is indistinguishable from "not yours"
The repo's scope query joins `ledger_members`, so both cases return `ErrLedgerNotFound` and the middleware renders 403. Answering 404 for one and 403 for the other would confirm a book's existence to a non-member.

### 4. Personal books are created lazily, on first resolve
**Chose**: `Resolve` creates the personal ledger when none exists.

**Rejected**: creating it inside `Register`. That path would have to be duplicated for Google OAuth, and it would leave every pre-M8 user without a book until they re-registered. Lazy creation covers registration, OAuth, and the backfilled past with one code path. Concurrent first-requests race; the partial unique index picks a winner and the loser re-reads.

### 5. Joining is a code, not an email invite
**Chose**: an 8-character code over a 32-symbol Crockford-style alphabet (no I/L/O/U), from `crypto/rand`, expiring in 7 days, revocable, one live code per book.

**Why**: there is no mailer in this service. Email invites mean a provider, a pending-invite table, and a deep link — roughly double the work for a two-person household. 40 bits of entropy behind an expiry and a revoke is a proportionate credential.

**Detail**: redemption normalizes case, spaces and hyphens, because the code's whole job is to be typed by a human off someone else's screen.

### 6. Reports normalize to the *book's* currency, not the user's
`ledgers.base_currency` replaced `users.base_currency` in the four reporting handlers. Two members with different personal defaults must read the same household totals. Side effect: the `s.svc.Me()` round-trip disappeared from every report handler, since the currency now rides on the principal.

### 7. `entries.user_id` became `created_by_user_id`, nullable — and survived
Dropping it would have discarded the only record of who logged an entry, which a shared book cannot reconstruct and which M9's splitting needs. Nullable because scheduler-materialized entries have no human author.

`accounts.user_id` was **dropped outright**, not renamed. Migration `009` says why: no write path sets it, so a nullable `owner_user_id` would have been a column that is always null pretending to be a fact. M9 settle-up therefore starts from no per-account ownership at all and must add the column itself.

*(Corrected 2026-08-22 during M10. This paragraph previously claimed the column became `owner_user_id`, nullable and advisory, which migration `009` never did.)*

### 8. Switching books wipes the local database
**Chose**: `unsafeResetDatabase()` + full re-pull on switch, after pushing pending writes and *refusing to switch* if anything is still unsynced.

**Rejected**: adding a `ledger_id` column to the WatermelonDB schema and filtering locally. That puts a second tenancy key on the device, and one missed filter shows household spending inside a personal balance. The server is the source of truth and the pull is one request; wiping is the smaller, safer thing.

**The hazard it guards**: a reset destroys unsynced local writes, which belong to the book being left. Hence push-first-then-verify-pending, and an error rather than a switch if the flush didn't land.

### 9. Splitting is explicitly *not* here
Boss asked for splitting in the same breath as sharing. It is M9, because there is nothing to split until a shared book exists, and M8 already migrates every money table — new balance math does not belong in that diff.

The design is settled though, and it is **not** a double-entry construct. Modelling each member as an equity account and forcing shares into ledger legs does not close: the per-member "share" debits duplicate the expense debit and cancel the category, destroying reporting. Splitwise itself keeps a per-expense split table. M9 will add `entry_splits(entry_id, user_id, share_minor)` and `entries.paid_by_user_id`; member balance = Σ funded − Σ share; settle-up is an ordinary transfer entry tagged `source='settlement'`. The balance invariant is untouched.

## Verification

- `go test -p 1 ./...` green, including a new `internal/household` suite covering lazy personal-book creation, non-member rejection, invite→join, owner-only invites, last-owner protection, and code supersession.
- **Migration 009 was applied to a scratch database seeded with pre-M8 rows**, not just to an empty schema: two users, cross-user duplicate category names, an entry with lines, a budget and a recurring rule. Verified zero orphan `ledger_id`s, zero misfiled rows, the journal still reconciling, and both users' same-named "Groceries" surviving the constraint swap. Up → down → up round-trips cleanly.
- HTTP end-to-end against a running server: personal book auto-created; non-member gets 403; invite→join works; one user posts into the shared book and the other reads it; neither sees it in their personal book; the entry records its author; balances reconcile; a EUR book owned by an IDR user reports in EUR; `/sync/pull` is ledger-scoped; last owner can't leave; a member can't evict an owner; a member who leaves loses access; a superseded code returns 404.
- Mobile `npm run check` (tsc + arithmetic self-checks) green.

## Open

- **Mobile runtime for M8 is unverified.** Types check and the checks pass, but the switch path (`unsafeResetDatabase` → re-pull) has not run on a device. It is the one piece with real teeth: it deletes local data.
- Local schema went to **v3** (adds `entries.fx_rate`, which `/sync/pull` had always sent and WatermelonDB was silently dropping). The migration is in place, but an existing local database upgrading in place is untested on-device.
- Apple Sign-In still outstanding (carried from M1).
- No backend deployment: still no Dockerfile, no CI, and `eas.json` production `EXPO_PUBLIC_API_URL` is a deliberate `.invalid` placeholder. *(Closed in M10, see `0016`; the placeholder remains, deliberately.)*
- `accounts` carries no owner column at all; M9 settle-up has to introduce one, with its writer and UI, from scratch.
