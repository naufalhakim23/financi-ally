# 0003 — M2 ledger core

**Date:** 2026-07-27 · **Status:** shipped + verified (tests + curl e2e)

## What landed
- `internal/pkg/money` — integer minor units, ISO 4217 scale table
  (`Scale`, `ToMinor`, `Format`, `IsAlpha3`). Promoted `isAlpha3` out of `auth`
  so both features share one currency validator.
- `internal/ledger` — `model`/`repo`/`service`, mirroring the auth 4-layer
  shape. `Post()` is the single write entrypoint; balance invariant asserted
  in-tx **and** by a Postgres trigger (defense in depth on a money path).
- Migrations `002_ledger` (accounts/entries/journal_lines + balance trigger).
- OpenAPI: accounts CRUD, `POST /entries` (Post), `GET /entries`, balance.
- Auth wiring upgraded: `protected` path-allowlist map → spec-derived
  `OapiRequestValidatorWithOptions` (kin-openapi) — every `security: bearerAuth`
  path is protected by the spec itself. `embedded-spec: true` so the validator
  loads `api.GetSwagger()`. Driven by a two-stage middleware: `AuthInject`
  (verify + ctx-inject once) + validator (enforce bearer presence → 401), because
  the validator does not propagate request-context mutations to the handler.

## Key decisions
- **Integer minor units, not numeric/decimal.** Plan's call; confirmed against
  the explorer's pushback. Float never touches a money field; `pkg/money` is the
  only arithmetic surface. IDR pinned to scale 0 (sen unused in practice).
- **Two-stage auth middleware, not AuthenticationFunc-only.** The validator's
  `AuthenticationFunc` can't inject the principal into the handler's context
  (nethttp-middleware calls `next.ServeHTTP(w, r)` with the original `r`).
  `AuthInject` runs before the validator, so the principal flows on the real
  request; `requireBearer` only checks presence.
- **Balance trigger as plain `AFTER STATEMENT`, not constraint trigger.**
  Constraint triggers reject `REFERENCING NEW TABLE`, and a single trigger with
  `INSERT OR UPDATE` rejects transition tables — so two single-event triggers
  share one function. Deferred constraint triggers would need transition tables
  too; plain statement-after-batched-insert suffices since `Post` inserts all
  lines in one statement.
- **goqu deferred to M4.** Ledger queries are simple enough in raw SQL; goqu
  earns its keep at M4 reporting where queries compose dynamically. Keeps the
  dep set lean and matches the auth repo's raw-SQL convention.

## Verification
`make test` (money unit + ledger integration: balanced post reconciles,
unbalanced → `ErrUnbalancedEntry`, transfer balances both pockets, cross-user
account rejected) + curl e2e (401/409/201/422, balance = −50000). Balance trigger
proven directly in psql (balanced commits, unbalanced rolls back).

Relates to [[0002-m1-auth]] (auth pattern this mirrors), [[0004-m3-sync]].
